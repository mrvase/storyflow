import Link from "next/link";

export default function Page() {
  return (
    <div className="absolute inset-0 bg-gray-900 text-white flex">
      <div className="w-full max-w-lg flex items-center">
        <div className="w-full px-12 flex flex-col gap-24">
          <h1 className="text-4xl text-gray-200">Opret bruger</h1>
          <div className="w-full flex flex-col gap-12">
            <div>
              <div className="text-sm text-gray-200">Navn</div>
              <input
                type="text"
                name="name"
                ls-ignore="true"
                className="w-full py-2.5 border-b-2 border-white border-opacity-50 focus:border-opacity-100 bg-transparent outline-none transition-colors"
                autoComplete="off"
              />
            </div>
            <div>
              <div className="text-sm text-gray-200">Email</div>
              <input
                type="text"
                name="email"
                ls-ignore="true"
                className="w-full py-2.5 border-b-2 border-white border-opacity-50 focus:border-opacity-100 bg-transparent outline-none transition-colors"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="w-full flex flex-col gap-5">
            <button className="w-full rounded-full bg-gray-200 hover:bg-white text-gray-900 text-sm text-center py-3 transition-colors">
              Opret bruger
            </button>
            <div className="w-full text-center text-sm">
              <Link href="login" className="hover:underline">
                Log ind
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-pink-600 flex items-center">
        <div className="flex-col px-24">
          <h1 className="text-4xl text-white"></h1>
        </div>
      </div>
    </div>
  );
}
