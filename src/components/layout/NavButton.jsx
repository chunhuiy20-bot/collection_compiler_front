import React from 'react';

function NavButton({ id, activePage, label, icon, onClick }) {
  const isActive = activePage === id;

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`min-w-[120px] md:w-full flex items-center justify-center md:justify-start p-3 rounded-lg transition-colors ${
        isActive ? 'bg-blue-600' : 'hover:bg-slate-800'
      }`}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </button>
  );
}

export default NavButton;
