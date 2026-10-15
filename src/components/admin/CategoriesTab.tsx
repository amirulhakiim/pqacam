import { useState } from 'react'
import { addCategoryFn, deleteCategoryFn, moveCategoryFn, renameCategoryFn } from '../../server/fns'
import type { TabProps } from './Shell'

export function CategoriesTab({ data, act }: TabProps) {
  const [name, setName] = useState('')
  const last = data.categories.length - 1

  async function add() {
    if (name.trim() && (await act(addCategoryFn({ data: name }), 'Category added'))) setName('')
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Categories</h2>
          <div className="adm-sub">These show as tabs on your page, in this order.</div>
        </div>
      </div>
      <div className="adm-list">
        {data.categories.map((c, i) => (
          <div className="adm-row adm-row-slim" key={`${c.id}:${c.name}`}>
            <input
              className="adm-input adm-inline"
              defaultValue={c.name}
              aria-label="Category name"
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              onBlur={async (e) => {
                const input = e.currentTarget
                if (input.value.trim() === c.name) return
                if (!(await act(renameCategoryFn({ data: { id: c.id, name: input.value } })))) input.value = c.name
              }}
            />
            <span className="adm-sub">
              {c.count} product{c.count === 1 ? '' : 's'}
            </span>
            <button type="button" className="btn-icon" disabled={i === 0} onClick={() => act(moveCategoryFn({ data: { id: c.id, dir: -1 } }))} title="Move up">
              ↑
            </button>
            <button type="button" className="btn-icon" disabled={i === last} onClick={() => act(moveCategoryFn({ data: { id: c.id, dir: 1 } }))} title="Move down">
              ↓
            </button>
            <button type="button" className="btn btn-danger btn-small" onClick={() => act(deleteCategoryFn({ data: c.id }), 'Category deleted')}>
              Delete
            </button>
          </div>
        ))}
        <div className="adm-add">
          <input
            className="adm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="New category, e.g. Bedroom"
          />
          <button type="button" className="btn btn-dark" onClick={add}>
            Add
          </button>
        </div>
      </div>
    </>
  )
}
