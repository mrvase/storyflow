import Link from "next/link";
export default function Page({ searchParams }: { searchParams?: any }) {
  const { name, email, orgs: orgs_ } = searchParams;
  const orgs = orgs_ === "" ? [] : orgs_.split(",");

  return (
    <div className="absolute inset-0 bg-gray-900 text-white flex">
      <div className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-pink-600 flex flex-col gap-24 px-12 py-24">
        <h1 className="text-4xl text-gray-200">Dine projekter</h1>
        <div className="grid grid-cols-2 gap-12">
          {orgs.map((el: string) => (
            <a
              href={`/${el}`}
              className="rounded-lg bg-white/10 p-10 font-light text-2xl"
            >
              /{el}
            </a>
          ))}
          <Link
            href="/bruger/opret"
            className="rounded-lg bg-white/10 p-10 font-light text-2xl"
          >
            Opret ny
          </Link>
        </div>
      </div>
      <div className="w-full max-w-lg flex items-center">
        <div className="w-full px-12 flex flex-col gap-24">
          <div className="mx-auto rounded-full w-56 h-56 bg-white" />
          <div className="w-full flex flex-col gap-12">
            <div>
              <div className="text-sm text-gray-200">Navn</div>
              {name}
            </div>
            <div>
              <div className="text-sm text-gray-200">Email</div>
              {email}
            </div>
          </div>
          <div className="w-full flex flex-col gap-5">
            <Link
              href="/logout"
              className="w-full rounded-full bg-gray-200 hover:bg-white text-gray-900 text-sm text-center py-3 transition-colors"
              prefetch={false}
            >
              Log ud
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
