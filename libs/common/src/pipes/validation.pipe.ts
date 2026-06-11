import {
  ValidationPipe,
  BadRequestException,
  ValidationError,
  UnprocessableEntityException,
} from '@nestjs/common';

export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true, // dùng để loại bỏ các field không được khai báo trong DTO
      transform: true, // dùng để chuyển đổi dữ liệu từ request body sang dữ liệu trong DTO
      exceptionFactory: (errors: ValidationError[]) => {
        const formattedErrors = errors.reduce((accumulator, error) => {
          accumulator[error.property] = Object.values(
            error.constraints ?? {},
          )[0];

          return accumulator;
        }, {});
        return new UnprocessableEntityException(formattedErrors);
      },
    });
  }
}
