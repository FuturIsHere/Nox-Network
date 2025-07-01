"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"

const BackButton = () => {
  const router = useRouter()

  const handleBack = () => {
    router.back()
  }

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
    >
      <ChevronLeft className="w-5 h-5 text-blue-500" />
      <p className="text-blue-500 hover:underline">Back</p>
    </button>
  )
}

export default BackButton