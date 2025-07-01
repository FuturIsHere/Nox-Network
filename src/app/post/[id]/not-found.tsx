// app/post/[id]/not-found.tsx
import Link from "next/link"
import { ArrowLeft, AlertCircle } from "lucide-react"

const PostNotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-[30px] shadow-md p-8 text-center">
        <div className="text-red-400 mb-4">
          <AlertCircle className="w-16 h-16 mx-auto" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Post introuvable
        </h1>
        
        <p className="text-gray-600 mb-6">
          Le post que vous recherchez n'existe pas ou a été supprimé.
        </p>
        
        <div className="space-y-3">
          <Link
            href="/notifications"
            className="flex items-center justify-center gap-2 w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux notifications
          </Link>
          
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default PostNotFound