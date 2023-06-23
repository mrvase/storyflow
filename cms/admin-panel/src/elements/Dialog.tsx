import { Dialog as HeadlessDialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
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
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-0 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <HeadlessDialog.Panel className="w-full max-w-md transform rounded-2xl bg-white dark:bg-gray-850 border border-gray-100 dark:border-gray-750 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-5">
                  <HeadlessDialog.Title className="text-lg font-medium leading-6">
                    {title}
                  </HeadlessDialog.Title>
                  <button
                    className="h-8 w-8 flex-center opacity-50 hover:opacity-100 rounded font-medium text-sm transition-opacity"
                    onClick={(ev) => {
                      ev.preventDefault();
                      close();
                    }}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
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

export const useDialog = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  const wrapInDialog = (children: React.ReactNode) => {
    return (
      <Dialog
        isOpen={isOpen}
        close={close}
        title={title}
        description={description}
      >
        {children}
      </Dialog>
    );
  };

  return { isOpen, open, close, wrapInDialog };
};
