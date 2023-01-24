import { Dialog as HeadlessDialog, Transition } from "@headlessui/react";
import React from "react";

export default function Dialog({
  isOpen,
  close,
  title,
  description,
  children,
}: {
  isOpen: boolean;
  close: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <HeadlessDialog
        open={isOpen}
        onClose={close}
        className="relative z-50 text-gray-800 dark:text-white"
      >
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <HeadlessDialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-700 p-6 text-left align-middle shadow-xl transition-all">
                <HeadlessDialog.Title className="text-lg font-medium leading-6 py-2">
                  {title}
                </HeadlessDialog.Title>
                <HeadlessDialog.Description className="my-4">
                  {description}
                </HeadlessDialog.Description>

                {children}
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  );
}
