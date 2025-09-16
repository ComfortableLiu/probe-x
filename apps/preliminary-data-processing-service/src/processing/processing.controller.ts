import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ProcessingService } from './processing.service';
// import { IAnyObj } from '@shared-types';

@Controller()
export class ProcessingController {
  constructor(private readonly processingService: ProcessingService) {}

  // 监听原始事件数据
  @EventPattern('raw_event_received')
  async handleRawEvent(@Payload() data: any) {
    console.log('收到原始事件数据:', data);
    return this.processingService.processRawEvent(data);
  }

  // 监听批量事件数据
  @EventPattern('batch_events_received')
  async handleBatchEvents(@Payload() data: any) {
    console.log('收到批量事件数据:', data);
    return this.processingService.processBatchEvents(data);
  }

  // 监听事件处理状态更新
  @EventPattern('event_processing_status')
  async handleProcessingStatus(@Payload() data: any) {
    console.log('收到处理状态更新:', data);
    return this.processingService.updateProcessingStatus(data);
  }
}
