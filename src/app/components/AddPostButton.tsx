"use client";

import { useFormStatus } from "react-dom";

const AddPostButton = () => {
  const { pending } = useFormStatus();
  return (
    <button
      className="bg-blue-500  py-2 px-3 mt-2 rounded-[99px] text-white disabled:bg-blue-300 disabled:cursor-not-allowed"
      disabled={pending}
    >
      {pending ? (
        <div className="flex items-center gap-2">
          <div className="inline-block h-[10px] w-[10px] animate-spin rounded-full border-2 border-white-300 border-solid border-current border-e-transparent align-[-0.125em] text-surface motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          Sending...
        </div>
      ) : (
        "Send"
      )}
    </button>
  );
};

export default AddPostButton;