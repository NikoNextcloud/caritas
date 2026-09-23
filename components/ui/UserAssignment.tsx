'use client'
import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

interface UserOption {
  uid: string
  displayName: string
  email: string
}

interface Props {
  value?: string
  onChange: (uid: string, displayName: string) => void
}

export default function UserAssignment({ value = '', onChange }: Props) {
  const [users, setUsers] = useState<UserOption[]>([])

  useEffect(() => {
    async function load() {
      await auth.authStateReady()
      if (!auth.currentUser) return
      try {
        const snapshot = await getDocs(collection(db, 'users'))
        setUsers(snapshot.docs.map(item => ({
          uid: item.id,
          displayName: item.data().displayName || item.data().email || 'Потребител',
          email: item.data().email || '',
        })))
      } catch {
        const own = await getDoc(doc(db, 'users', auth.currentUser.uid))
        if (own.exists()) setUsers([{
          uid: own.id,
          displayName: own.data().displayName || own.data().email || 'Потребител',
          email: own.data().email || '',
        }])
      }
    }
    load()
  }, [])

  return (
    <div className="form-group">
      <label className="form-label">Възложено на</label>
      <select className="form-control" value={value} onChange={event => {
        const selected = users.find(user => user.uid === event.target.value)
        onChange(event.target.value, selected?.displayName || '')
      }}>
        <option value="">Без конкретен потребител</option>
        {users.map(user => <option key={user.uid} value={user.uid}>{user.displayName}{user.email ? ` (${user.email})` : ''}</option>)}
      </select>
    </div>
  )
}
