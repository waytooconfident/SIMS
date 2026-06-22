import { v4 as uuidv4 } from 'uuid'
import { stmtAll, stmtGet, run } from '../database/sqlHelpers'
import type { IPlatformRepository } from '../core/interfaces/IPlatformRepository'
import type { Platform, PlatformFee, CreatePlatformInput, UpdatePlatformInput } from '@shared/types'

export class SqlitePlatformRepository implements IPlatformRepository {
  /** Attach each platform's fee line-items and the summed total %. */
  private attachFees(platforms: Platform[]): Platform[] {
    const fees = stmtAll<PlatformFee>('SELECT * FROM PlatformFees ORDER BY SortOrder ASC, FeeName ASC')
    return platforms.map((p) => {
      const own = fees.filter((f) => f.PlatformID === p.PlatformID)
      return {
        ...p,
        fees: own,
        TotalFeePercentage: own.filter((f) => f.FeeType !== 'fixed').reduce((s, f) => s + f.FeePercentage, 0),
        TotalFixedFee: own.filter((f) => f.FeeType === 'fixed').reduce((s, f) => s + f.FeePercentage, 0)
      }
    })
  }

  findAll(): Platform[] {
    const rows = stmtAll<Platform>('SELECT * FROM Platforms ORDER BY PlatformName ASC')
    return this.attachFees(rows)
  }

  findById(platformID: string): Platform | undefined {
    const row = stmtGet<Platform>('SELECT * FROM Platforms WHERE PlatformID = :id', { ':id': platformID })
    return row ? this.attachFees([row])[0] : undefined
  }

  create(input: CreatePlatformInput): Platform {
    const record: Platform = {
      PlatformID: uuidv4(),
      PlatformName: input.PlatformName,
      FixedFee: input.FixedFee ?? 0,
      CreatedAt: new Date().toISOString()
    }
    run(
      'INSERT INTO Platforms (PlatformID, PlatformName, FixedFee, CreatedAt) VALUES (:id, :name, :fixed, :createdAt)',
      { ':id': record.PlatformID, ':name': record.PlatformName, ':fixed': record.FixedFee, ':createdAt': record.CreatedAt }
    )
    return { ...record, fees: [], TotalFeePercentage: 0, TotalFixedFee: 0 }
  }

  update(platformID: string, input: UpdatePlatformInput): Platform | undefined {
    const existing = this.findById(platformID)
    if (!existing) return undefined
    const merged = { ...existing, ...input }
    run('UPDATE Platforms SET PlatformName = :name, FixedFee = :fixed WHERE PlatformID = :id', {
      ':name': merged.PlatformName,
      ':fixed': merged.FixedFee,
      ':id': platformID
    })
    return this.findById(platformID)
  }

  delete(platformID: string): boolean {
    return run('DELETE FROM Platforms WHERE PlatformID = :id', { ':id': platformID }) > 0
  }
}
