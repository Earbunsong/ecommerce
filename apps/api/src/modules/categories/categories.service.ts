import { AppError, isUniqueViolation } from '../../lib/errors.js'
import { slugify, uniqueSlug } from '../../lib/slug.js'
import { type Category, categoriesRepository } from './categories.repository.js'
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schemas.js'

export type CategoryNode = Pick<Category, 'id' | 'name' | 'slug'> & {
  children: Pick<Category, 'id' | 'name' | 'slug'>[]
}

const slugTaken = (err: unknown) =>
  isUniqueViolation(err, 'categories_slug_unique')
    ? new AppError('ALREADY_EXISTS', 'A category with this slug already exists.')
    : err

/**
 * Max 2 levels (ERD §3): a parent must exist and be top-level itself, a category cannot be its
 * own parent, and a category that has children cannot become a sub-category.
 */
async function assertValidParent(categoryId: string | null, parentId: string | null) {
  if (parentId === null) return
  if (parentId === categoryId) {
    throw new AppError('VALIDATION_ERROR', 'A category cannot be its own parent.')
  }
  const parent = await categoriesRepository.findById(parentId)
  if (!parent) throw new AppError('VALIDATION_ERROR', 'The parent category does not exist.')
  if (parent.parentId !== null) {
    throw new AppError('VALIDATION_ERROR', 'Categories can only be 2 levels deep.')
  }
  if (categoryId && (await categoriesRepository.countChildren(categoryId)) > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'This category has sub-categories, so it cannot become a sub-category itself.',
    )
  }
}

export const categoriesService = {
  /** Shop: active categories only. A sub-category is hidden when its parent is inactive. */
  async activeTree(): Promise<CategoryNode[]> {
    const all = (await categoriesRepository.listAll()).filter((c) => c.isActive)
    const pick = ({ id, name, slug }: Category) => ({ id, name, slug })
    return all
      .filter((c) => c.parentId === null)
      .map((parent) => ({
        ...pick(parent),
        children: all.filter((c) => c.parentId === parent.id).map(pick),
      }))
  },

  listAll: () => categoriesRepository.listAll(),

  async create(input: CreateCategoryInput): Promise<Category> {
    await assertValidParent(null, input.parentId)
    const slug =
      input.slug ??
      (await uniqueSlug(
        slugify(input.name),
        async (s) => !!(await categoriesRepository.findBySlug(s)),
      ))
    try {
      return await categoriesRepository.create({ ...input, slug })
    } catch (err) {
      throw slugTaken(err)
    }
  },

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    if (!(await categoriesRepository.findById(id))) {
      throw new AppError('NOT_FOUND', 'Category not found.')
    }
    if (input.parentId !== undefined) await assertValidParent(id, input.parentId)
    try {
      return (await categoriesRepository.update(id, input))!
    } catch (err) {
      throw slugTaken(err)
    }
  },
}
