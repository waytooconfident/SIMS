import { v4 as uuidv4 } from 'uuid'
import { stmtAll, stmtGet, run } from '../database/sqlHelpers'
import type { IPlatformFeeRepository } from '../core/interfaces/IPlatformRepository'
import type { PlatformFee, CreatePlatformFeeInput, UpdatePlatformFeeInput } from '@shared/types'

export class SqlitePlatformFeeRepository implements IPlatformFeeRepository {
  findByPlatform(platformID: string): PlatformFee[] {
    return stmtAll('SELECT * FROM PlatformFees WHERE PlatformID = :pid ORDER BY SortOrder ASC, FeeName ASC', {
      ':pid': platformID
    })
  }

  create(input: CreatePlatformFeeInput): PlatformFee {
    const maxRow = stmtGet<{ maxOrder: number | null }>(
      'SELECT MAX(SortOrder) AS maxOrder FROM PlatformFees WHERE PlatformID = :pid',
      { ':pid': input.PlatformID }
    )
    const record: PlatformFee = {
      FeeID: uuidv4(),
      PlatformID: input.PlatformID,
      FeeName: input.FeeName,
      FeePercentage: input.FeePercentage ?? 0,
      FeeType: input.FeeType ?? 'percent',
      SortOrder: (maxRow?.maxOrder ?? -1) + 1
    }
    run(
      `INSERT INTO PlatformFees (FeeID, PlatformID, FeeName, FeePercentage, FeeType, SortOrder)
       VALUES (:id, :pid, :name, :pct, :type, :sort)`,
      {
        ':id': record.FeeID,
        ':pid': record.PlatformID,
        ':name': record.FeeName,
        ':pct': record.FeePercentage,
        ':type': record.FeeType,
        ':sort': record.SortOrder
      }
    )
    return record
  }

  update(feeID: string, input: UpdatePlatformFeeInput): PlatformFee | undefined {
    const existing = stmtGet<PlatformFee>('SELECT * FROM PlatformFees WHERE FeeID = :id', { ':id': feeID })
    if (!existing) return undefined
    const merged = { ...existing, ...input }
    run('UPDATE PlatformFees SET FeeName = :name, FeePercentage = :pct, FeeType = :type, SortOrder = :sort WHERE FeeID = :id', {
      ':name': merged.FeeName,
      ':pct': merged.FeePercentage,
      ':type': merged.FeeType,
      ':sort': merged.SortOrder,
      ':id': feeID
    })
    return merged
  }

  delete(feeID: string): boolean {
    return run('DELETE FROM PlatformFees WHERE FeeID = :id', { ':id': feeID }) > 0
  }
}
