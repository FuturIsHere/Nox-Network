import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import MobileMenu from "./MobileMenu";
import SearchBarWrapper from "./SearchBarWrapper";
import NotificationButton from "./NotificationButton";
import MessageButton from "./MessageButton";
import { DropdownProvider } from "@/contexts/DropdownContext";
import { UnreadMessagesProvider } from "@/contexts/UnreadMessagesContext";

const Navbar = async () => {
  const clerkUser = await currentUser();

  let usernameLink = "/";

  if (clerkUser) {
    const user = await prisma.user.findUnique({
      where: { id: clerkUser.id },
      select: { username: true },
    });

    if (user?.username) {
      usernameLink = `/profile/${user.username}/followers`;
    }
  }

  return (
    <div className="h-10 flex items-center justify-between px-4">
      {/* LEFT */}
      <div className="md:hidden lg:block w-[20%]">
        <Link className="flex items-center gap-2" href="/">
          <Image src="/logo.png" alt="Homepage" width={26} height={26} className="w-6 h-6" />
          <span className="font-[700]">Nox Network</span>
        </Link>
      </div>

      {/* CENTRE */}
      <div className="hidden md:flex w-[50%] items-center justify-between">
        <div className="flex gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/home.png" alt="Homepage" width={16} height={16} />
            <span className="text-[14px]">Homepage</span>
          </Link>

          <Link href={usernameLink} className="flex items-center gap-2">
            <Image src="/friends.png" alt="Friends" width={20} height={20} />
            <span className="text-[14px]">Friends</span>
          </Link>
        </div>

        <div className="hidden xl:block w-64">
          <SearchBarWrapper />
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-[30%] flex items-center gap-4 xl:gap-8 justify-end">
        <ClerkLoading>
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-solid border-e-transparent align-[-0.125em] text-surface motion-reduce animate-[spin_1.5s_linear_infinite]" />
        </ClerkLoading>
        <ClerkLoaded>
          <SignedIn>
            {/* Provider pour gérer l'exclusivité des dropdowns ET les messages non lus */}
            <UnreadMessagesProvider>
              <DropdownProvider>
                <div className="cursor-pointer">
                  <MessageButton />
                </div>
                <div className="cursor-pointer">
                  <NotificationButton />
                </div>
              </DropdownProvider>
            </UnreadMessagesProvider>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <div className="flex items-center gap-2">
              <Image src="/login.png" alt="" width={20} height={20} />
              <Link href="sign-in">Login</Link>
            </div>
          </SignedOut>
        </ClerkLoaded>
        <MobileMenu />
      </div>
    </div>
  );
};

export default Navbar;