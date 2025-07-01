import { User } from "@/generated/prisma"
import Ad from "../Ad"
import Suggestions from "./Suggestions"
import FriendRequests from "./FriendRequests"
import UserInfoCard from "./UserInfoCard"
import UserMediaCard from "./UserMediaCard"
import { Suspense } from "react"

const RightMenu = ({ user }: { user?: User }) => {
  return (
    <div className='flex flex-col gap-6'>
      {user ? (
        <>
          <Suspense fallback="Loading ...">
            <UserInfoCard user={user} />
          </Suspense>
          <Suspense fallback="Loading ...">
            <UserMediaCard user={user} />
          </Suspense>
        </>
      ) : null}
      <FriendRequests />
      <Suggestions />
      <Ad size="md" />
    </div>
  )
}

export default RightMenu