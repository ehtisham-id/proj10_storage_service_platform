import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : 500;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: 'Internal server error'
    });
  }
}
