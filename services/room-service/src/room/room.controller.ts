import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomStatus } from './entities/room.entity';
import { RoomService } from './room.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('rooms')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  @ApiOperation({ summary: 'List rooms, optionally filtered by roomTypeId/status (public)' })
  findAll(@Query('roomTypeId') roomTypeId?: string, @Query('status') status?: RoomStatus) {
    return this.roomService.findAll({
      roomTypeId: roomTypeId ? Number(roomTypeId) : undefined,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room by id (public)' })
  @ApiResponse({ status: 404 })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.roomService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: create a new room' })
  create(@Body() dto: CreateRoomDto, @Req() req: RequestWithUser) {
    return this.roomService.create(dto, req.user.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: update a room' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomDto,
    @Req() req: RequestWithUser,
  ) {
    return this.roomService.update(id, dto, req.user.sub);
  }
}
