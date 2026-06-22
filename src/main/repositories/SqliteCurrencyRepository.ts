import { stmtAll, stmtGet, run } from '../database/sqlHelpers'
import type { Currency, CreateCurrencyInput, UpdateCurrencyInput } from '@shared/types'

// Currencies + their NT$ exchange rate. 'TWD' is the protected base (rate 1).
export class SqliteCurrencyRepository {
  findAll(): Currency[] {
    return stmtAll('SELECT * FROM Currencies ORDER BY SortOrder ASC, CurrencyCode ASC')
  }

  findByCode(code: string): Currency | undefined {
    return stmtGet('SELECT * FROM Currencies WHERE CurrencyCode = :c', { ':c': code })
  }

  private nextSortOrder(): number {
    const row = stmtGet<{ maxOrder: number | null }>('SELECT MAX(SortOrder) AS maxOrder FROM Currencies')
    return (row?.maxOrder ?? -1) + 1
  }

  create(input: CreateCurrencyInput): Currency {
    const code = input.CurrencyCode.trim().toUpperCase()
    if (!code) throw new Error('幣別代碼不能為空。')
    if (!input.CurrencyName?.trim()) throw new Error('幣別名稱不能為空。')
    if (!(input.RateToTWD > 0)) throw new Error('匯率必須大於 0。')
    if (this.findByCode(code)) throw new Error(`幣別代碼「${code}」已存在。`)

    const record: Currency = {
      CurrencyCode: code,
      CurrencyName: input.CurrencyName.trim(),
      RateToTWD: input.RateToTWD,
      SortOrder: this.nextSortOrder(),
      CreatedAt: new Date().toISOString()
    }
    run(
      `INSERT INTO Currencies (CurrencyCode, CurrencyName, RateToTWD, SortOrder, CreatedAt)
       VALUES (:code, :name, :rate, :sort, :createdAt)`,
      { ':code': record.CurrencyCode, ':name': record.CurrencyName, ':rate': record.RateToTWD, ':sort': record.SortOrder, ':createdAt': record.CreatedAt }
    )
    return record
  }

  update(code: string, input: UpdateCurrencyInput): Currency {
    const existing = this.findByCode(code)
    if (!existing) throw new Error(`幣別「${code}」不存在。`)
    if (code === 'TWD') throw new Error('「新台幣」為基準幣別，匯率固定為 1，無法修改。')

    const name = input.CurrencyName?.trim() || existing.CurrencyName
    const rate = input.RateToTWD ?? existing.RateToTWD
    if (!(rate > 0)) throw new Error('匯率必須大於 0。')
    run('UPDATE Currencies SET CurrencyName = :name, RateToTWD = :rate WHERE CurrencyCode = :code', {
      ':name': name, ':rate': rate, ':code': code
    })
    return { ...existing, CurrencyName: name, RateToTWD: rate }
  }

  delete(code: string): boolean {
    if (code === 'TWD') throw new Error('「新台幣」為基準幣別，無法刪除。')
    return run('DELETE FROM Currencies WHERE CurrencyCode = :code', { ':code': code }) > 0
  }
}
