// contexts/DropdownContext.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type DropdownType = 'messages' | 'notifications' | null

interface DropdownContextType {
  openDropdown: DropdownType
  setOpenDropdown: (dropdown: DropdownType) => void
  isDropdownOpen: (dropdown: DropdownType) => boolean
  closeAllDropdowns: () => void
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined)

export const useDropdown = () => {
  const context = useContext(DropdownContext)
  if (!context) {
    throw new Error('useDropdown must be used within a DropdownProvider')
  }
  return context
}

interface DropdownProviderProps {
  children: ReactNode
}

export const DropdownProvider = ({ children }: DropdownProviderProps) => {
  const [openDropdown, setOpenDropdownState] = useState<DropdownType>(null)

  const setOpenDropdown = (dropdown: DropdownType) => {
    setOpenDropdownState(dropdown)
  }

  const isDropdownOpen = (dropdown: DropdownType) => {
    return openDropdown === dropdown
  }

  const closeAllDropdowns = () => {
    setOpenDropdownState(null)
  }

  return (
    <DropdownContext.Provider
      value={{
        openDropdown,
        setOpenDropdown,
        isDropdownOpen,
        closeAllDropdowns,
      }}
    >
      {children}
    </DropdownContext.Provider>
  )
}