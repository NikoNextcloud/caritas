'use client'
import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { getUser, getUsers } from '@/lib/db'

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
        const records = await getUsers()
        setUsers(records.map(item => ({
          uid: item.uid,
          displayName: item.displayName || item.email || 'Потребител',
          email: item.email || '',
        })))
      } catch {
        const own = await getUser(auth.currentUser.uid)
        if (own) setUsers([{
          uid: own.uid,
          displayName: own.displayName || own.email || 'Потребител',
          email: own.email || '',
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
