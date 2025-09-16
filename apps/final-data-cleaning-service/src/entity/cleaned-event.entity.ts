import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('cleaned_events')
export class CleanedEvent {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    name: 'processed_event_id',
  })
  processedEventId?: number;

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
    name: 'cleaning_status',
    default: 'pending',
  })
  cleaningStatus?: string;

  @Column({
    name: 'cleaned_at',
    nullable: true,
  })
  cleanedAt?: Date;

  @Column({
    name: 'final_data',
    type: 'json',
    nullable: true,
  })
  finalData?: any;

  @Column({
    name: 'cleaning_metadata',
    type: 'json',
    nullable: true,
  })
  cleaningMetadata?: any;

  @Column({
    name: 'quality_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  qualityScore?: number;

  @Column({
    name: 'is_valid',
    default: true,
  })
  isValid?: boolean;

  @Column({
    name: 'validation_errors',
    type: 'json',
    nullable: true,
  })
  validationErrors?: any;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt?: Date;
}
