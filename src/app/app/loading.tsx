/** Dashboard skeleton, shown while wallet data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-8">
        <div className="skeleton h-12 w-72 max-w-full rounded-2xl" />
        <div className="skeleton mt-4 h-4 w-96 max-w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-32 rounded-3xl" />)}
      </div>
      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        <div className="skeleton h-96 rounded-3xl lg:col-span-2" />
        <div className="skeleton h-96 rounded-3xl" />
      </div>
      <div className="skeleton mt-4 h-80 rounded-3xl lg:mt-6" />
    </div>
  );
}
