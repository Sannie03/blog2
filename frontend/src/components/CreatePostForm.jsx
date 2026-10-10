import React from 'react'
import { deleteContentImage } from '../services/api'

const availableTopics = [
  'News',
  'Technology',
  'Lifestyle',
  'Business',
  'Entertainment',
  'Health',
  'Education',
  'Travel',
]

const availableTags = [
  'Bollywood', 'Indian Cinema', 'Young Star', 'Rising Star', 'Fashion Icon',
  'Filmmakers', 'Cinema', 'Cannes Film Festival', 'NextGen Gaming',
  'Survival Horror', 'Gaming Community',
]

function MultiSelectDropdown({ label, placeholder, value, options, onChange }) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const selected = value.split(',').map((item) => item.trim()).filter(Boolean)
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(search.toLowerCase()))

  function toggleOption(option) {
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]
    onChange(next.join(', '))
  }

  function addCustomValue(event) {
    if (event.key !== 'Enter' || !search.trim()) return
    event.preventDefault()
    const customValue = search.trim()
    if (!selected.includes(customValue)) onChange([...selected, customValue].join(', '))
    setSearch('')
  }

  return (
    <div className="field-group pick-box multi-select-field">
      <label>{label}</label>
      <button type="button" className={`multi-select-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span className="multi-select-icon">⌕</span>
        <span className={selected.length ? 'selected-value' : 'placeholder-value'}>
          {selected.length ? selected.join(', ') : placeholder}
        </span>
        <span className="multi-select-caret">⌄</span>
      </button>
      {open && (
        <div className="multi-select-menu">
          <input
            autoFocus
            className="multi-select-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={addCustomValue}
            placeholder="Search options..."
          />
          <div className="multi-select-options">
            {filteredOptions.map((option) => (
              <label key={option} className={`multi-select-option ${selected.includes(option) ? 'selected' : ''}`}>
                <input type="checkbox" checked={selected.includes(option)} onChange={() => toggleOption(option)} />
                <span>{option}</span>
              </label>
            ))}
            {!filteredOptions.length && <div className="no-options">Press Enter to add a custom value</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function CreatePostForm({ form, setForm, onSubmit, onReset, onBack, status, onUploadImage, isSaving = false }) {
  const [uploadPreviews, setUploadPreviews] = React.useState([])
  const [uploadError, setUploadError] = React.useState('')
  const pendingPreviews = React.useRef(new Set())
  const mounted = React.useRef(false)
  React.useEffect(() => {
    mounted.current = true
    const previews = pendingPreviews.current
    return () => {
      mounted.current = false
      previews.forEach(url => URL.revokeObjectURL(url))
      previews.clear()
    }
  }, [])
  React.useEffect(() => {
    const preview = form.featureImage
    return () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview) }
  }, [form.featureImage])
  async function insertImageMarkdown(file, cursorPosition) {
    if (!file.type.startsWith('image/')) return
    const preview = URL.createObjectURL(file)
    pendingPreviews.current.add(preview)
    setUploadPreviews(current => [...current, { url: preview, name: file.name || 'Pasted image' }])
    setUploadError('')
    try {
      const uploaded = await onUploadImage(file)
      if (!mounted.current) {
        void deleteContentImage(uploaded.url).catch(() => {})
        return
      }
      const imgMarkdown = `![image](${uploaded.url})\n\n`
      setForm((prevForm) => {
        const current = prevForm.description || ''
        return { ...prevForm, description: `${current.slice(0, cursorPosition)}${imgMarkdown}${current.slice(cursorPosition)}` }
      })
    } catch (error) {
      if (mounted.current) setUploadError(error.message || 'Unable to upload image. Please paste it again.')
    } finally {
      URL.revokeObjectURL(preview)
      pendingPreviews.current.delete(preview)
      if (mounted.current) setUploadPreviews(current => current.filter(image => image.url !== preview))
    }
  }

  function handleDescriptionPaste(event) {
    const clipboardData = event.clipboardData
    if (!clipboardData) {
      return
    }

    const clipboardItems = clipboardData.items
    if (!clipboardItems || !clipboardItems.length) {
      return
    }

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i]
      if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
        try {
          const file = item.getAsFile()
          if (file) {
            const textarea = event.target
            if (!textarea) {
              return
            }

            event.preventDefault()
            const cursorPosition = textarea.selectionStart || 0
            insertImageMarkdown(file, cursorPosition)
            break // Process only first image
          }
        } catch (error) {
          console.error('Error getting file from clipboard:', error)
        }
      }
    }

  }

  function handleDescriptionDrop(event) {
    event.preventDefault()
    event.stopPropagation()

    const dataTransfer = event.dataTransfer
    if (!dataTransfer) return

    const files = dataTransfer.files
    if (!files || !files.length) return

    const textarea = event.target
    if (!textarea) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type && file.type.startsWith('image/')) {
        const cursorPosition = textarea.selectionStart || 0
        insertImageMarkdown(file, cursorPosition)
      }
    }
  }

  function handleDescriptionDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }

  return (
    <section className="create-post-wrapper">
      <div className="panel-header">
        <button type="button" className="back-arrow" aria-label="Back to posts" onClick={onBack} disabled={isSaving || uploadPreviews.length > 0}>←</button>
        <h2>Create post</h2>
      </div>

      <p className="subtitle">Complete the post content and publishing options.</p>

      <form className="content-form" onSubmit={(event) => {
        if (pendingPreviews.current.size) { event.preventDefault(); return }
        onSubmit(event)
      }}>
        <div className="two-col top-row">
          <div className="field-group image-box">
            <label>Feature image URL</label>
            <input
              type="text"
              placeholder="Paste image URL here"
              value={form.featureImage || ''}
              onChange={(event) => {
                const value = event.target.value
                setForm({ ...form, featureImage: value, featureImageFile: null })
              }}
            />
            <div className="divider-or">OR</div>
            <input
              id="feature-image-file"
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                setForm({
                  ...form,
                  featureImageFile: file,
                  featureImage: URL.createObjectURL(file),
                })
              }}
            />
            <label htmlFor="feature-image-file" className="image-picker">⤴ Choose image</label>

            {form.featureImage && (
              <div className="preview-image-wrap">
                <img className="feature-preview-image" src={form.featureImage} alt="Feature preview" />
              </div>
            )}
          </div>

          <div className="field-group">
            <label>Title <span>*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
        </div>

        <div className="two-col compact-row">
          <div className="field-group">
            <label>Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </div>
          <div className="field-group hidden-field" />
          <div className="field-group">
            <label>Status</label>
            <select
              value={form.status || 'published'}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div className="two-col middle-row">
          <MultiSelectDropdown
            label="Categories"
            placeholder="Select categories"
            value={form.categories}
            options={availableTopics}
            onChange={(categories) => setForm({ ...form, categories })}
          />
          <MultiSelectDropdown
            label="Tags"
            placeholder="Select tags"
            value={form.tags}
            options={availableTags}
            onChange={(tags) => setForm({ ...form, tags })}
          />
        </div>

        <div className="two-col middle-row">
          <div className="field-group pick-box">
            <label>Prev chapter</label>
            <input
              type="text"
              placeholder="No chapter"
              value={form.prevChapter}
              onChange={(event) => setForm({ ...form, prevChapter: event.target.value })}
            />
          </div>

          <div className="field-group pick-box">
            <label>Next chapter</label>
            <input
              type="text"
              placeholder="No chapter"
              value={form.nextChapter}
              onChange={(event) => setForm({ ...form, nextChapter: event.target.value })}
            />
          </div>
        </div>

        <div className="editor-box">
          <label>Description</label>
          <div className="editor-toolbar">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Insert</span>
            <span>Format</span>
            <span>Tools</span>
            <span>Table</span>
            <span>Help</span>
            <button 
              type="button" 
              className="insert-image-btn"
              onClick={() => {
                const text = prompt('Enter image URL:')
                if (text) {
                  const imgMarkdown = `![image](${text})\n`
                  setForm({ ...form, description: form.description + imgMarkdown })
                }
              }}
              title="Insert image from URL"
            >
              🖼 Insert Image
            </button>
          </div>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            onPaste={handleDescriptionPaste}
            onDrop={handleDescriptionDrop}
            onDragOver={handleDescriptionDragOver}
            placeholder="Write your content here... (Paste images or drag & drop!)"
          />
          {uploadPreviews.length > 0 && <div className="upload-previews" role="status">
            <p>Uploading {uploadPreviews.length} image(s)... You can keep writing.</p>
            {uploadPreviews.map(image => <img key={image.url} src={image.url} alt={image.name} />)}
          </div>}
          {uploadError && <p className="image-error" role="alert">{uploadError}</p>}
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={onReset} disabled={isSaving || uploadPreviews.length > 0}>Reset</button>
          <button type="submit" className="primary-btn" disabled={isSaving || uploadPreviews.length > 0}>
            {isSaving ? 'Saving...' : 'Save post'}
          </button>
        </div>
      </form>

      {status && <div className="status-message">{status}</div>}
    </section>
  )
}

export default CreatePostForm
