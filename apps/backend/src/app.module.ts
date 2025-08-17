import { Module } from '@nestjs/common';
// import DatabaseModule from "./database/database.module";
import EnvConfigModule from "./database/env-config.module";
import { ResponseInterceptor } from "@src/interceptors/response.interceptor";

@Module({
  imports: [
    EnvConfigModule,
    // DatabaseModule,
  ],
  providers: [{
    provide: 'APP_INTERCEPTOR',
    useClass: ResponseInterceptor,
  }]
})
export class AppModule {
}
