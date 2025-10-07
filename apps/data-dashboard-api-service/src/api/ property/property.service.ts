import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { EventPropertyRelationEntity } from "@entity/EventPropertyRelation.entity"
import { IPropertyListItem, IQueryCommonPropertyListRes, MetaPropertyBusinessType } from "@probe-x/shared-types/src"
import { MetaPropertyEntity } from "@entity/MetaProperty.entity"

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(MetaPropertyEntity)
    private propertyRepository: Repository<MetaPropertyEntity>,
    @InjectRepository(EventPropertyRelationEntity)
    private eventPropertyRelationRepository: Repository<EventPropertyRelationEntity>,
  ) {
  }

  async getPropertiesByEventName(eventName: string): Promise<IPropertyListItem[]> {
    const relations = await this.eventPropertyRelationRepository.find({
      where: {
        metaEvent: {
          eventName,
        },
      },
      relations: ['metaProperty', 'createUser', 'updateUser'],
    })

    return relations.map(relation => ({
      propertyName: relation.metaProperty.propertyName,
      propertyType: relation.metaProperty.propertyType,
      status: relation.metaProperty.status,
      createTime: relation.metaProperty.createTime,
      updateTime: relation.metaProperty.updateTime,
      eventPropertyRemark: relation.eventPropertyRemark,
      createUserId: relation.metaProperty.createUserId,
      createUsername: relation.createUser?.username,
      createNickname: relation.createUser?.nickname,
      updateUserId: relation.metaProperty.updateUserId,
      updateUsername: relation.updateUser?.username,
      updateNickname: relation.updateUser?.nickname,
      type: relation.metaProperty.type,
    }))
  }

  async getCommonProperties(): Promise<IQueryCommonPropertyListRes> {
    const list = await this.propertyRepository.find({
      where: {
        type: MetaPropertyBusinessType.COMMON,
      },
      relations: ['createUser', 'updateUser'],
    })
    return list.map(item => ({
      propertyName: item.propertyName,
      propertyType: item.propertyType,
    }))
  }
}
