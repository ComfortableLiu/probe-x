import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    name: 'original_event_id',
  })
  originalEventId?: number;

  @Column({
    name: 'event_name',
  })
  eventName?: string;

  @Column()
  ip?: string;

  @Column()
  ua?: string;

  @Column()
  site?: string;

  @Column()
  path?: string;

  @Column()
  params?: string;

  @Column({
    name: 'device_id',
  })
  deviceId?: string;

  @Column()
  referrer?: string;

  @Column()
  utmSource?: string;

  @Column()
  utmMedium?: string;

  @Column()
  utmCampaign?: string;

  @Column()
  utmTerm?: string;

  @Column()
  utmContent?: string;

  @Column({
    name: 'log_time',
  })
  logTime?: Date;

  @Column({
    name: 'service_time',
  })
  serviceTime?: Date;

  @Column({
    name: 'processing_status',
    default: 'pending',
  })
  processingStatus?: string;

  @Column({
    name: 'processed_at',
    nullable: true,
  })
  processedAt?: Date;

  @Column({
    name: 'cleaned_data',
    type: 'json',
    nullable: true,
  })
  cleanedData?: any;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt?: Date;
}
