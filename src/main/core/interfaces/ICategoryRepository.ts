import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@shared/types'

export interface ICategoryRepository {
  findAll(): Category[]
  findById(categoryID: string): Category | undefined
  create(input: CreateCategoryInput): Category
  update(categoryID: string, input: UpdateCategoryInput): Category | undefined
  delete(categoryID: string): boolean
}
