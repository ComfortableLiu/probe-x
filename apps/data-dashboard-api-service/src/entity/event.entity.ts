import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('event_01')
export class EventEntity {
  @PrimaryGeneratedColumn()
  id?: number

  @Column({
    name: 'event_name',
  })
  eventName?: string

  @Column()
  ip?: string

  @Column()
  ua?: string

  @Column()
  site?: string

  @Column()
  path?: string

  @Column()
  params?: string

  @Column({
    name: 'device_id',
  })
  deviceId?: string

  @Column()
  referrer?: string

  @Column()
  utmSource?: string

  @Column()
  utmMedium?: string

  @Column()
  utmCampaign?: string

  @Column()
  utmTerm?: string

  @Column()
  utmContent?: string

  @Column({
    name: 'log_time',
  })
  logTime?: Date

  @Column({
    name: 'service_time',
  })
  serviceTime?: Date
}
