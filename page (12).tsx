@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  body { @apply bg-gray-50 text-gray-900 antialiased text-sm; }
  input, select, textarea {
    @apply border border-gray-200 rounded-lg px-3 py-2 text-sm
           focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white;
  }
  label { @apply block text-xs font-medium text-gray-600 mb-1; }
}

@layer components {
  .btn { @apply inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed; }
  .btn-primary { @apply bg-blue-600 text-white border-transparent hover:bg-blue-700; }
  .btn-success { @apply bg-green-600 text-white border-transparent hover:bg-green-700; }
  .btn-danger  { @apply bg-red-600  text-white border-transparent hover:bg-red-700;  }
  .btn-warning { @apply bg-amber-500 text-white border-transparent hover:bg-amber-600; }
  .btn-sm { @apply px-2.5 py-1.5 text-xs; }

  .card { @apply bg-white rounded-xl border border-gray-100 shadow-sm; }
  .card-body { @apply p-5; }
  .card-header { @apply px-5 py-4 border-b border-gray-100 flex items-center justify-between; }

  .badge { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium; }
  .badge-blue   { @apply bg-blue-50   text-blue-700 ring-1 ring-blue-200; }
  .badge-green  { @apply bg-green-50  text-green-700 ring-1 ring-green-200; }
  .badge-amber  { @apply bg-amber-50  text-amber-700 ring-1 ring-amber-200; }
  .badge-red    { @apply bg-red-50    text-red-700 ring-1 ring-red-200; }
  .badge-gray   { @apply bg-gray-100  text-gray-600; }
  .badge-purple { @apply bg-purple-50 text-purple-700 ring-1 ring-purple-200; }

  .table-base { @apply w-full text-sm border-collapse; }
  .table-base th { @apply text-left text-xs font-medium text-gray-500 px-4 py-3 border-b border-gray-100 bg-gray-50; }
  .table-base td { @apply px-4 py-3 border-b border-gray-50 align-middle; }
  .table-base tr:hover td { @apply bg-gray-50; }
  .table-base tr:last-child td { @apply border-b-0; }

  .stat-card { @apply bg-gray-50 rounded-xl p-4; }
  .stat-val   { @apply text-2xl font-semibold text-gray-900 mt-1; }
  .stat-lbl   { @apply text-xs text-gray-500; }

  .form-group { @apply flex flex-col gap-1 mb-4; }
  .form-grid-2 { @apply grid grid-cols-2 gap-4; }
  .form-grid-3 { @apply grid grid-cols-3 gap-4; }

  .sidebar-link { @apply flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors; }
  .sidebar-link.active { @apply bg-white/15 text-white font-medium; }

  .page-header { @apply flex items-center justify-between mb-6; }
  .page-title  { @apply text-xl font-semibold text-gray-900; }
}
