import { GroupModel } from '../models/Group.model'

export const GroupService = {
  async createGroup(groupData: any, participants: string[]) {
    const group = await GroupModel.create(groupData)
    for (const participantId of participants) {
      await GroupModel.addMember(group.id, participantId)
    }
    return group
  },

  async addMembers(groupId: string, userIds: string[]) {
    for (const userId of userIds) {
      await GroupModel.addMember(groupId, userId)
    }
  },

  async removeMember(groupId: string, userId: string) {
    await GroupModel.removeMember(groupId, userId)
  },

  async updateMemberRole(groupId: string, userId: string, role: string) {
    await GroupModel.updateMemberRole(groupId, userId, role)
  },
}