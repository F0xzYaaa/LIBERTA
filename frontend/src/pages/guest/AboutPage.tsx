import heroImage from '../../assets/bb1.jpg';

export function AboutPage(): JSX.Element {
  return (
    <div>
      <section
        className="relative flex min-h-[320px] items-end bg-cover bg-center text-cream"
        style={{
          backgroundImage: `linear-gradient(rgba(26,42,29,0.6), rgba(26,42,29,0.6)), url(${heroImage})`,
        }}
      >
        <div className="mx-auto max-w-4xl px-6 pb-12">
          <h1 className="font-serif text-4xl font-semibold">About LIBERTA HUAHIN</h1>
          <p className="mt-2 font-sans text-cream/90">
            A quiet boutique hotel by the Gulf of Thailand
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <section>
          <h2 className="font-serif text-2xl font-semibold text-primary-dark">Our Story</h2>
          <p className="mt-3 font-sans leading-relaxed text-primary-dark/90">
            LIBERTA HUAHIN began as a small family guesthouse a few streets back from Hua Hin&apos;s
            beach road, and grew, room by room, into the boutique hotel it is today. We kept what
            mattered from those early years &mdash; knowing our guests by name, a garden that&apos;s
            actually used, and mornings unhurried enough to matter &mdash; and added the comforts of
            a proper hotel around it.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-primary-dark">
            A Room for Every View
          </h2>
          <p className="mt-3 font-sans leading-relaxed text-primary-dark/90">
            Hua Hin gave us three different landscapes to build around, so we did. Our sea-facing
            suites look straight out over the Gulf of Thailand, close enough to hear the waves at
            night. Our garden and forest-view rooms sit further back, shaded and quiet, looking onto
            the hotel&apos;s own greenery. And our hillside mountain-retreat rooms sit a little
            higher again, catching the breeze that rolls down from the hills west of town. Wherever
            you stay, the view was the first thing we designed around &mdash; not the last.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-primary-dark">
            Hua Hin, at Your Doorstep
          </h2>
          <p className="mt-3 font-sans leading-relaxed text-primary-dark/90">
            We&apos;re a short walk from Hua Hin&apos;s beach, the night market on Dechanuchit Road,
            and the fishing-pier restaurants that have fed this town for generations. Ask our team
            for directions to Khao Takiab&apos;s monkey hill, the Cicada weekend market, or a quiet
            table for seafood at sunset &mdash; Hua Hin is small enough to explore on foot, and
            we&apos;re happy to point the way.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-primary-dark">
            Amenities &amp; Services
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 font-sans text-primary-dark/90 sm:grid-cols-2">
            <li>Breakfast included on most room types</li>
            <li>Free WiFi throughout the property</li>
            <li>Private garden and pool-adjacent seating</li>
            <li>Front-desk assistance in Thai and English</li>
            <li>Airport and train station transfers on request</li>
            <li>Laundry and housekeeping service</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-primary-dark">Book With Us</h2>
          <p className="mt-3 font-sans leading-relaxed text-primary-dark/90">
            Browse our room types, request the dates you have in mind, and our team will confirm
            your stay directly over Line or Facebook &mdash; no card details needed up front.
            It&apos;s a slower way to book a hotel room, and we think it suits us.
          </p>
        </section>
      </div>
    </div>
  );
}
