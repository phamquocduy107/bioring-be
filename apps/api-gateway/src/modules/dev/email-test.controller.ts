import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/common';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { EmailTestService } from './email-test.service';

@ApiTags('Dev · Email')
@Controller('api/v1/dev/email')
export class EmailTestController {
  constructor(private readonly emailTestService: EmailTestService) {}

  @Post('test')
  @Public()
  @ApiOperation({
    summary: 'Gửi email template test (dev)',
    description:
      'Chỉ bật khi NODE_ENV≠production hoặc ENABLE_EMAIL_TEST=true. Dùng từ /demo/email-previews/',
  })
  sendTest(@Body() body: SendTestEmailDto) {
    return this.emailTestService.sendTest(
      body.to,
      body.template,
      body.fullName,
    );
  }
}
