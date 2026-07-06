import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UploadRoomImageDto } from './dto/upload-room-image.dto';
import { RoomImageService } from './room-image.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

// Multer-level cap is a coarse first line of defense; RoomImageService enforces the
// real, configurable limit (ROOM_IMAGE_MAX_SIZE_BYTES) plus content-based MIME sniffing.
const MULTER_HARD_CAP_BYTES = 10 * 1024 * 1024;

@ApiTags('room-images')
@Controller('rooms/:id/images')
export class RoomImageController {
  constructor(private readonly roomImageService: RoomImageService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Staff')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Staff/Admin: upload an image for a room' })
  @ApiResponse({ status: 400, description: 'Bad MIME type or file too large' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CAP_BYTES },
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) roomId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadRoomImageDto,
    @Req() req: RequestWithUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.roomImageService.upload(
      roomId,
      { buffer: file.buffer, size: file.size },
      dto,
      req.user.sub,
    );
  }
}
