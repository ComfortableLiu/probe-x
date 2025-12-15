import { Controller } from '@nestjs/common'
import { UserService } from "../user/user.service"

@Controller('/system-data')
export class SystemDataController {
  constructor(
    private readonly userService: UserService,
  ) {
  }

}
