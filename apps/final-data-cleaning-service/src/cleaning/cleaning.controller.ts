import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CleaningService } from './cleaning.service';
import { IAnyObj } from '@shared-types';

@Controller()
export class CleaningController {
  constructor(private readonly cleaningService: CleaningService) {}

  // 监听初步处理完成的事件
  @EventPattern('event_preliminary_processed')
  async handlePreliminaryProcessed(@Payload() data: IAnyObj) {
    console.log('收到初步处理完成的事件:', data);
    return this.cleaningService.performFinalCleaning(data);
  }

  // 监听批量清洗请求
  @EventPattern('batch_cleaning_request')
  async handleBatchCleaning(@Payload() data: IAnyObj) {
    console.log('收到批量清洗请求:', data);
    return this.cleaningService.performBatchCleaning(data);
  }

  // 监听数据质量检查请求
  @EventPattern('data_quality_check')
  async handleDataQualityCheck(@Payload() data: IAnyObj) {
    console.log('收到数据质量检查请求:', data);
    return this.cleaningService.performDataQualityCheck(data);
  }

  // 监听清洗状态更新
  @EventPattern('cleaning_status_update')
  async handleCleaningStatusUpdate(@Payload() data: IAnyObj) {
    console.log('收到清洗状态更新:', data);
    return this.cleaningService.updateCleaningStatus(data);
  }
}
