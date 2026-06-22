import type {
  Platform,
  CreatePlatformInput,
  UpdatePlatformInput,
  PlatformFee,
  CreatePlatformFeeInput,
  UpdatePlatformFeeInput
} from '@shared/types'

export interface IPlatformRepository {
  /** Each platform comes back with its fee line-items and summed total %. */
  findAll(): Platform[]
  findById(platformID: string): Platform | undefined
  create(input: CreatePlatformInput): Platform
  update(platformID: string, input: UpdatePlatformInput): Platform | undefined
  delete(platformID: string): boolean
}

export interface IPlatformFeeRepository {
  findByPlatform(platformID: string): PlatformFee[]
  create(input: CreatePlatformFeeInput): PlatformFee
  update(feeID: string, input: UpdatePlatformFeeInput): PlatformFee | undefined
  delete(feeID: string): boolean
}
