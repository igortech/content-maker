import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-green-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-green-50 flex items-center justify-between">
          <h3 className="text-xl font-bold text-green-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-50 rounded-xl text-green-400 hover:text-green-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
