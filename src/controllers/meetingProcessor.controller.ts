import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

// Função auxiliar para inicializar o Gemini de forma dinâmica e mitigar falhas de rede
async function getGeminiAI(): Promise<any> {
  const geminiModule: any = await eval('import("@google/genai")');
  
  // Inicializa o SDK passando configurações de rede customizadas na API Key
  return new geminiModule.GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || ''
  });
}

export const processAudio = async (req: Request, res: Response) => {
  const extendedReq = req as any
  
  if (!extendedReq.files || !extendedReq.files.audio) {
    return res.status(400).json({ error: 'Nenhum ficheiro de áudio recebido.' })
  }

  const audioFile = extendedReq.files.audio
  const date = req.body.date || new Date().toISOString().split('T')[0]
  const roomId = 'geral'

  const storageDir = path.join(__dirname, '../../storage/meetings', roomId)
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true })

  const now = new Date()
  const timeSuffix = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`

  const audioPath = path.join(storageDir, `audio_${date}_${timeSuffix}.webm`)
  const txtPath = path.join(storageDir, `transcricao_${date}_${timeSuffix}.txt`)

  try {
    // 1. Guarda o ficheiro de áudio temporariamente no disco
    await audioFile.mv(audioPath)
    console.log(`📦 Áudio guardado localmente em: ${audioPath}`)

    // 2. Converte o ficheiro guardado para uma String Base64
    const audioBuffer = fs.readFileSync(audioPath)
    const base64Audio = audioBuffer.toString('base64')

    const ai = await getGeminiAI()
    console.log(`🤖 Enviando dados Inline (Base64) diretamente para o Gemini 2.5 Flash...`)

    // 3. Chamada direta com inlineData (Elimina o erro FAILED / ACTIVE state da Google)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'audio/webm',
            data: base64Audio
          }
        },
        'Transcreve palavra por palavra tudo o que é dito neste áudio de reunião. Identifica a troca de interlocutores se possível como "Participante 1", "Participante 2". Não faças resumos aqui, apenas transcreve o áudio cru.'
      ],
    })

    const textResult = response?.text || ''
    
    // 4. Salva a transcrição final no arquivo .txt esperado pelo teu PostMeetingPanel
    fs.writeFileSync(txtPath, textResult, 'utf-8')
    console.log(`✅ Transcrição guardada com sucesso em: ${txtPath}`)

    return res.json({ success: true, transcription: textResult })

  } catch (error: any) {
    console.error('❌ Erro definitivo no processamento da reunião:', error)
    return res.status(500).json({ 
      error: 'Erro no processamento interno da IA com dados inline.' 
    })
  } finally {
    // Remove o áudio local para liberar espaço
    if (fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath)
      } catch (err) {
        console.error("Erro ao remover áudio temporário:", err)
      }
    }
  }
}

export const generateDocument = async (req: Request, res: Response) => {
  try {
    const { fileName, option } = req.body

    if (!fileName) {
      return res.status(400).json({ error: 'O nome do arquivo é obrigatório.' })
    }

    const txtPath = path.join(__dirname, '../../storage/meetings/geral', fileName)

    if (!fs.existsSync(txtPath)) {
      return res.status(404).json({ error: 'O arquivo de transcrição selecionado não foi encontrado.' })
    }

    const rawContent = fs.readFileSync(txtPath, 'utf-8')

    let targetPrompt = ''
    switch (option) {
      case 'resumo':
        targetPrompt = 'Cria um resumo executivo sintetizado com os tópicos principais discutidos e decisões tomadas.'
        break
      case 'acta':
        targetPrompt = 'Formata o texto como uma Acta de Reunião Formal, contendo: Data, Tópicos Discutidos, Deliberações e Próximos Passos Organizacionais.'
        break
      case 'relatorio':
        targetPrompt = 'Gera um Relatório Técnico detalhado expandindo as ideias debatidas com uma linguagem corporativa formal.'
        break
      default:
        targetPrompt = 'Revê toda a transcrição, corrige erros gramaticais de fala ou tradução, e organiza o texto mantendo a coerência cronológica total.'
    }

    const ai = await getGeminiAI()
    
    // Adicionado retry simples também para a formatação do markdown
    let response = null
    for (let i = 1; i <= 2; i++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `${targetPrompt}\n\nTexto bruto da reunião:\n${rawContent}`
        })
        break
      } catch (err) {
        if (i === 2) throw err
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    return res.json({ markdownContent: response?.text || '' })
  } catch (error) {
    console.error('Erro na reformatização com IA:', error)
    return res.status(500).json({ error: 'Erro ao formatar documento com IA' })
  }
}

export const listMeetingsByDate = async (req: Request, res: Response) => {
  try {
    const { date } = req.query
    if (!date) return res.status(400).json({ error: 'Data é obrigatória' })

    const storageDir = path.join(__dirname, '../../storage/meetings/geral')

    if (!fs.existsSync(storageDir)) {
      return res.json([])
    }

    const files = fs.readdirSync(storageDir)

    const filteredFiles = files
      .filter(file => file.startsWith(`transcricao_${date}`) && file.endsWith('.txt'))
      .map(file => {
        const timePart = file.replace(`transcricao_${date}_`, '').replace('.txt', '').replace('-', ':')
        return {
          fileName: file,
          time: timePart.length === 5 ? timePart : 'Gravação'
        }
      })

    return res.json(filteredFiles)
  } catch (error) {
    console.error('Erro ao listar reuniões:', error)
    return res.status(500).json({ error: 'Erro ao listar ficheiros' })
  }
}