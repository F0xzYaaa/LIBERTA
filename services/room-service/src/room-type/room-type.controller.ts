import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomTypeService } from './room-type.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('room-types')
@Controller('room-types')
export class RoomTypeController {
  constructor(private readonly roomTypeService: RoomTypeService) {}

  @Get()
  @ApiOperation({ summary: 'List all room types (public)' })
  findAll() {
    return this.roomTypeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room type by id (public)' })
  @ApiResponse({ status: 404 })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.roomTypeService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: create a new room type' })
  create(@Body() dto: CreateRoomTypeDto, @Req() req: RequestWithUser) {
    return this.roomTypeService.create(dto, req.user.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: update a room type' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomTypeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.roomTypeService.update(id, dto, req.user.sub);
  }
}
