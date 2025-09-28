import { ConfigModule } from "@nestjs/config"
import path from "node:path"
import configuration from "../../config/configuration"

export default ConfigModule.forRoot({
  envFilePath: path.resolve(path.dirname(path.dirname(__dirname)), `/config/env/.env.${process.env.NODE_ENV || 'development'}`),
  isGlobal: true,
  load: [configuration],
})
