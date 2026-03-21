import React from "react";

export default function EditProfileNameDialog({ isOpen, onClose, onSave }) {
  if (!isOpen) return null;

  return (
    // 1. Backdrop Wrapper: FIXED, FULLSCREEN, CENTERED, PADDED
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop Overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 2. Modal Box: FULL WIDTH (padded by parent), MAX WIDTH, BACKGROUND, ROUNDED, PADDED */}
      <div className="relative w-full max-w-sm bg-kosha-bg rounded-2xl p-6 overflow-hidden shadow-lg z-10">
        {/* Dialog Content */}
        <h2 className="text-xl font-semibold mb-4">Edit Profile Name</h2>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 mb-6 focus:outline-none focus:ring focus:border-blue-400"
          placeholder="Your new name"
        />

        {/* 3. Buttons Row: EVEN SPACING OR END-ALIGNED, GAP, FULL-WIDTH (as per constraints) */}
        <div className="w-full flex gap-3 mt-6">
          <button
            className="flex-1 py-2 px-4 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark transition"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}