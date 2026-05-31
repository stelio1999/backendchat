import { CallModel } from '../models/Call.model'

export const CallService = {
  async startCall(callData: any) {
    const call = await CallModel.create(callData)
    return call
  },

  async endCall(callId: string, duration: number) {
    await CallModel.updateStatus(callId, 'ended', new Date(), duration)
  },

  async getCallHistory(userId: string) {
    const history = await CallModel.getUserCallHistory(userId)
    return history
  },
}