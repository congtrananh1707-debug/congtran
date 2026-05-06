import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { formatDate } from '../../utils/helpers'

const COVER_EMOJIS = ['📸', '🎂', '🏖️', '🎄', '🌸', '🎊', '🏕️', '🎭', '🌍', '🎓', '🎁', '🌺']

export default function MemoryAlbums() {
  const albums = useStore((s) => s.albums)
  const photos = useStore((s) => s.photos)
  const members = useStore((s) => s.members)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const addAlbum = useStore((s) => s.addAlbum)
  const removeAlbum = useStore((s) => s.removeAlbum)
  const addPhoto = useStore((s) => s.addPhoto)
  const removePhoto = useStore((s) => s.removePhoto)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  const [view, setView] = useState<'list' | 'album' | 'slideshow'>('list')
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [slideshowIdx, setSlideshowIdx] = useState(0)
  const [showAddAlbum, setShowAddAlbum] = useState(false)
  const [showAddPhoto, setShowAddPhoto] = useState(false)
  const [albumForm, setAlbumForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], coverEmoji: '📸', description: '' })
  const [photoForm, setPhotoForm] = useState({ caption: '', taggedMembers: [] as string[], date: new Date().toISOString().split('T')[0] })
  const [photoData, setPhotoData] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const currentAlbum = albums.find((a) => a.id === selectedAlbum)
  const albumPhotos = photos.filter((p) => p.albumId === selectedAlbum)

  const openAlbum = (id: string) => {
    setSelectedAlbum(id)
    setView('album')
  }

  const openSlideshow = (idx: number) => {
    setSlideshowIdx(idx)
    setView('slideshow')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoData(ev.target?.result as string || '')
    reader.readAsDataURL(file)
  }

  const submitAlbum = () => {
    if (!albumForm.title.trim()) return
    addAlbum(albumForm.title.trim(), albumForm.date, albumForm.coverEmoji, albumForm.description)
    setAlbumForm({ title: '', date: new Date().toISOString().split('T')[0], coverEmoji: '📸', description: '' })
    setShowAddAlbum(false)
  }

  const submitPhoto = () => {
    if (!photoData || !selectedAlbum) return
    addPhoto(selectedAlbum, photoData, photoForm.caption, photoForm.taggedMembers, photoForm.date)
    setPhotoData('')
    setPhotoForm({ caption: '', taggedMembers: [], date: new Date().toISOString().split('T')[0] })
    setShowAddPhoto(false)
  }

  const toggleTag = (id: string) => {
    setPhotoForm((prev) => ({
      ...prev,
      taggedMembers: prev.taggedMembers.includes(id) ? prev.taggedMembers.filter((t) => t !== id) : [...prev.taggedMembers, id],
    }))
  }

  // Slideshow view
  if (view === 'slideshow' && albumPhotos.length > 0) {
    const photo = albumPhotos[slideshowIdx]
    const tagged = members.filter((m) => photo.taggedMembers.includes(m.id))

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent">
          <button onClick={() => setView('album')} className="text-white text-sm flex items-center gap-1">← Quay lại</button>
          <span className="text-white/70 text-sm">{slideshowIdx + 1} / {albumPhotos.length}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.img key={photo.id} src={photo.dataUrl} alt={photo.caption}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="w-full h-full object-contain" />
        </AnimatePresence>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          {photo.caption && <p className="text-white font-medium text-lg mb-2">{photo.caption}</p>}
          {tagged.length > 0 && (
            <div className="flex gap-2 mb-2">
              {tagged.map((m) => (
                <span key={m.id} className="text-sm text-white/80">{m.emoji} {m.name}</span>
              ))}
            </div>
          )}
          <p className="text-white/50 text-xs">{photo.date}</p>
          <div className="flex gap-4 mt-3 justify-center">
            <button onClick={() => setSlideshowIdx((i) => Math.max(0, i - 1))} disabled={slideshowIdx === 0}
              className="text-white/60 hover:text-white disabled:opacity-30 text-3xl">‹</button>
            <button onClick={() => setSlideshowIdx((i) => Math.min(albumPhotos.length - 1, i + 1))} disabled={slideshowIdx === albumPhotos.length - 1}
              className="text-white/60 hover:text-white disabled:opacity-30 text-3xl">›</button>
          </div>
        </div>
      </div>
    )
  }

  // Album detail view
  if (view === 'album' && currentAlbum) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-4">← Album</button>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{currentAlbum.coverEmoji}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{currentAlbum.title}</h2>
              <p className="text-gray-400 text-sm">{currentAlbum.date} · {albumPhotos.length} ảnh</p>
            </div>
          </div>
          <div className="flex gap-2">
            {albumPhotos.length > 0 && (
              <button onClick={() => openSlideshow(0)} className="bg-violet-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium">▶ Slideshow</button>
            )}
            {isParent && (
              <>
                <button onClick={() => setShowAddPhoto(true)} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl text-sm font-medium">+ Ảnh</button>
                <button onClick={() => { removeAlbum(currentAlbum.id); setView('list') }} className="text-gray-300 hover:text-red-400 px-2 py-1.5 rounded-xl text-sm">🗑</button>
              </>
            )}
          </div>
        </div>

        {/* Add photo form */}
        <AnimatePresence>
          {showAddPhoto && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 mb-5"
            >
              <h3 className="font-bold text-gray-700 mb-4">📸 Thêm ảnh</h3>
              <div className="mb-3">
                <div onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors ${photoData ? 'border-violet-400' : 'border-gray-300'}`}>
                  {photoData ? (
                    <img src={photoData} alt="preview" className="w-full max-h-48 object-contain rounded-xl" />
                  ) : (
                    <div className="text-gray-400">
                      <p className="text-4xl mb-2">📷</p>
                      <p className="text-sm">Bấm để chọn ảnh (tối đa 2MB)</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Chú thích</label>
                  <input value={photoForm.caption} onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                    placeholder="VD: Sinh nhật bé An..." className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ngày chụp</label>
                  <input type="date" value={photoForm.date} onChange={(e) => setPhotoForm({ ...photoForm, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-2">Tag thành viên</label>
                <div className="flex gap-2 flex-wrap">
                  {members.map((m) => (
                    <button key={m.id} onClick={() => toggleTag(m.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${photoForm.taggedMembers.includes(m.id) ? 'bg-violet-100 border-violet-400 text-violet-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {m.emoji} {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submitPhoto} disabled={!photoData}
                  className="bg-violet-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 hover:bg-violet-700">
                  Thêm ảnh
                </button>
                <button onClick={() => { setShowAddPhoto(false); setPhotoData('') }} className="text-gray-500 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {albumPhotos.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-3">📷</p>
            <p>Album này chưa có ảnh nào. {isParent ? 'Thêm ảnh đầu tiên!' : 'Nhờ bố/mẹ thêm ảnh nhé!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {albumPhotos.map((p, i) => {
              const tagged = members.filter((m) => p.taggedMembers.includes(m.id))
              return (
                <motion.div key={p.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-sm"
                  onClick={() => openSlideshow(i)}>
                  <img src={p.dataUrl} alt={p.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    {p.caption && <p className="text-white text-xs font-medium truncate">{p.caption}</p>}
                    {tagged.length > 0 && <p className="text-white/70 text-xs">{tagged.map((m) => m.emoji).join('')}</p>}
                  </div>
                  {isParent && (
                    <button onClick={(e) => { e.stopPropagation(); removePhoto(p.id) }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      ✕
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Album list view
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📸 Album kỷ niệm</h1>
          <p className="text-gray-500 text-sm">{albums.length} album · {photos.length} ảnh</p>
        </div>
        {isParent && (
          <button onClick={() => setShowAddAlbum(true)} className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700">
            + Album mới
          </button>
        )}
      </div>

      {/* Add album form */}
      <AnimatePresence>
        {showAddAlbum && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 mb-5"
          >
            <h3 className="font-bold text-gray-700 mb-4">📁 Tạo album mới</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tên album</label>
                <input value={albumForm.title} onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })}
                  placeholder="VD: Sinh nhật 2024..." className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Ngày</label>
                <input type="date" value={albumForm.date} onChange={(e) => setAlbumForm({ ...albumForm, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">Mô tả (tuỳ chọn)</label>
              <input value={albumForm.description} onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })}
                placeholder="VD: Kỳ nghỉ hè tại Đà Nẵng..." className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">Ảnh bìa</label>
              <div className="flex flex-wrap gap-2">
                {COVER_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setAlbumForm({ ...albumForm, coverEmoji: e })}
                    className={`text-2xl p-2 rounded-xl transition-all ${albumForm.coverEmoji === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'hover:bg-gray-100'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submitAlbum} className="bg-violet-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-violet-700">Tạo album</button>
              <button onClick={() => setShowAddAlbum(false)} className="text-gray-500 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {albums.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">📷</p>
          <p>Chưa có album nào. {isParent ? 'Tạo album đầu tiên!' : 'Nhờ bố/mẹ tạo album nhé!'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {albums.map((album, i) => {
            const aPhotos = photos.filter((p) => p.albumId === album.id)
            const preview = aPhotos[0]

            return (
              <motion.div key={album.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.07 }}
                onClick={() => openAlbum(album.id)}
                className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="h-40 bg-gradient-to-br from-violet-100 to-indigo-100 relative overflow-hidden">
                  {preview ? (
                    <img src={preview.dataUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-7xl opacity-40">{album.coverEmoji}</div>
                  )}
                  <div className="absolute top-3 left-3 text-3xl">{album.coverEmoji}</div>
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                    {aPhotos.length} ảnh
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800">{album.title}</h3>
                  {album.description && <p className="text-gray-500 text-sm mt-0.5 truncate">{album.description}</p>}
                  <p className="text-gray-400 text-xs mt-1">{album.date}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
