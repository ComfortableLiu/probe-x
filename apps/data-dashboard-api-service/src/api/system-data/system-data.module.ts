import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SystemDataController } from './system-data.controller'
import { SystemDataService } from './system-data.service'
import { UserModule } from '../user/user.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    UserModule,
  ],
  controllers: [SystemDataController],
  providers: [SystemDataService],
  exports: [],
})
export class SystemDataModule {
}
