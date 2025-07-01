"use client"

import { useFormStatus } from "react-dom"

const UpdateButton = () => {
    const {pending} = useFormStatus ()

    return (
        <button className="bg-black p-2 mt-2 rounded-[99px] text-white disabled:bg-opacity-50 disabled:cursor-not-allowed"   disabled={pending}>
            {pending ? "Updating..." : "Update"}
        </button>

    )
}

export default UpdateButton