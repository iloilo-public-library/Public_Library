"use client";

import {
  Accessibility,
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Book,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Code2,
  Coffee,
  Eye,
  FileText,
  FileX2,
  Flag,
  Hand,
  Heart,
  Landmark,
  Laptop,
  Lightbulb,
  Link2,
  ListChecks,
  Lock,
  MapPin,
  MessageSquare,
  Newspaper,
  Phone,
  QrCode,
  Scale,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Smartphone,
  Star,
  Target,
  ThumbsUp,
  Usb,
  Users,
  Volume1,
  Wifi,
  Workflow,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { CIRCULATION_POLICY } from "@/components/circulation/types";

const QUALITY_POLICY_ITEMS = [
  "Acquire and generate relevant library resources.",
  "Implement responsive policies, programs, and initiatives.",
  "Employ dynamic technology to deliver products and services to relevant interested parties.",
  "Provide efficient, effective, and sustainable services aimed towards the highest satisfaction of its stakeholders.",
  "Comply with statutory requirements and continually improve our quality management system.",
];

const CORE_VALUES = [
  {
    icon: Users,
    title: "Inclusiveness",
    desc: "We create a welcoming environment and provide quality services without bias to gender, socio-economic status, or ethnicity. We believe everyone deserves equitable access to information.",
  },
  {
    icon: ThumbsUp,
    title: "Respect",
    desc: "We treat all library users and staff with respect and dignity in every interaction.",
  },
  {
    icon: ShieldCheck,
    title: "Responsibility",
    desc: "We are responsible for the safekeeping of our resources and ensuring their continued availability for future generations.",
  },
  {
    icon: Workflow,
    title: "Teamwork",
    desc: "We view our patrons as members of our team. We appreciate people for who they are and the significant contributions they make to the organization.",
  },
  {
    icon: Link2,
    title: "Collaborative",
    desc: "We collaborate to accomplish our mission. We value different points of view and absorb as much knowledge as we can from others.",
  },
  {
    icon: MessageSquare,
    title: "Communication",
    desc: "Our patrons are the reason the library exists. We encourage open communication through social media, suggestion boxes, and email.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    desc: "We are a learning organization that embraces change and takes appropriate risks to address community needs.",
  },
  {
    icon: Star,
    title: "Excellence",
    desc: "We provide up-to-date collections and creative programs for all ages, inculcating a strong sense of responsibility and integrity among all employees.",
  },
  {
    icon: Heart,
    title: "Passion",
    desc: "We ensure that librarians and libraries provide quality services and resources, and encourage both staff and patrons to enjoy their time in the library.",
  },
];

const LIBRARY_SECTIONS = [
  {
    icon: Newspaper,
    title: "Periodical Section",
    desc: "Houses magazines, journals, newspapers, and other regularly published materials. Covers a wide range of subjects with both print and online access to keep you informed on current events and research.",
  },
  {
    icon: BookOpen,
    title: "General Reference Section",
    desc: "A collection of dictionaries, encyclopedias, atlases, almanacs, and reference books organized alphabetically. Resources here are for room-use only and provide quick, reliable answers across all fields of study.",
  },
  {
    icon: ArrowLeftRight,
    title: "Circulation Section",
    desc: `Located on the 2nd floor of the building, this section manages the borrowing and returning of library materials. Up to ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS} books may be loaned out for ${CIRCULATION_POLICY.DEFAULT_LOAN_DAYS} days (max ${CIRCULATION_POLICY.MAX_LOAN_DAYS} days), with up to ${CIRCULATION_POLICY.MAX_RENEWALS} renewals available.`,
  },
  {
    icon: Briefcase,
    title: "Law Books",
    desc: "Contains legal treatises, law journals, law reviews, legal dictionaries, encyclopedias, and various legal reference works arranged by subject — from contract law to international law.",
  },
  {
    icon: Flag,
    title: "Filipiniana Section",
    desc: "A dedicated space showcasing books and materials about Philippine history, culture, and society — a must-visit area offering a deeper understanding of the country's past, present, and future.",
  },
  {
    icon: Smile,
    title: "Children's Section",
    desc: "Features storybooks, toys, DVDs, and academic books for kids covering math, science, and more. Walk-in children are also welcomed for personal storytelling sessions.",
  },
  {
    icon: Laptop,
    title: "DICT Tech4ED Center",
    desc: "A Technology for Economic Development center under the eFilipino program of DOST-ICT. It aims to harness ICT to enable, empower, and transform society towards an inclusive, integrated, and equitable countryside.",
  },
  {
    icon: Accessibility,
    title: "PWD Section",
    desc: "Features a Braille collection, sensory materials, and educational tools for persons with disabilities — including PWD Math materials and fine motor skill resources for all ages and abilities.",
  },
];

const GENERAL_GUIDELINES = [
  {
    icon: Clock,
    text: "The library is open Monday–Saturday from 8:00 AM to 8:00 PM, except on holidays.",
  },
  {
    icon: QrCode,
    text: "Library users must register by scanning the QR code at the courtesy counter upon entrance.",
  },
  {
    icon: ShoppingBag,
    text: "Bags and personal belongings (except valuables) must be deposited at the courtesy counter upon entrance.",
  },
  {
    icon: Coffee,
    text: "Cold snacks and lidded drinks are permitted; patrons are responsible for their own garbage.",
  },
  {
    icon: Volume1,
    text: "Conversation must be kept at an appropriate and acceptable level.",
  },
  {
    icon: Smartphone,
    text: "Mobile phones must be set to silent mode. Phone calls must be done outside the library.",
  },
  {
    icon: Wifi,
    text: "Library users who wish to use the Internet must register their names in the log-book.",
  },
  {
    icon: Hand,
    text: "Library furnishings, equipment, and materials must be handled with care.",
  },
  {
    icon: Book,
    text: "Books must be placed on the table after use for library staff to check and shelve.",
  },
  {
    icon: CalendarCheck,
    text: `A maximum of ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS} active books are allowed for home reading for ${CIRCULATION_POLICY.DEFAULT_LOAN_DAYS} days (up to ${CIRCULATION_POLICY.MAX_LOAN_DAYS} days max), renewable up to ${CIRCULATION_POLICY.MAX_RENEWALS} times when eligible.`,
  },
  {
    icon: Lock,
    text: "Books in the General Reference Section are for room-use only. Only Circulation Section books can be loaned out.",
  },
  {
    icon: AlertTriangle,
    text: "Anyone found damaging or losing library property is liable for its replacement.",
  },
  {
    icon: Ban,
    text: "Business transactions, meetings, games, Facebook, and non-study-related movie streaming are strictly prohibited.",
  },
  {
    icon: Usb,
    text: "Saving files using flash drives is prohibited to prevent the spread of computer viruses.",
  },
  {
    icon: FileText,
    text: "Only needed pages from a book are allowed to be photocopied.",
  },
];

const DISTRICT_BRANCHES = [
  "Justice Ramon Avanceña District Library, Arevalo",
  "Sta. Filomena Reading Center, Arevalo",
  "Nabitasan Reading Center, La Paz",
  "Quintin Salas Reading Center, Jaro",
  "PHHC Blk. 17 Reading Center, Mandurriao",
  "PHHC Blk. 22 Reading Center, Mandurriao",
  "South Fundidor Reading Center, Molo",
  "Rizal Pala-Pala II Reading Center, City Proper",
  "Plaza Libertad Outdoor Community Library",
  "Molo Plaza Outdoor Community Library",
];

const DEV_TEAM = [
  { initials: "AO", num: "Member 01", name: "Anthony S. Ojera", tone: "border-accent/25 bg-accent/15 text-accent" },
  { initials: "KT", num: "Member 02", name: "Keiru Dane S. Tuerto", tone: "border-accent2/25 bg-accent2/15 text-accent2" },
  { initials: "KS", num: "Member 03", name: "Krystal Laura Sangacena", tone: "border-warn/25 bg-warn/15 text-warn" },
  { initials: "JF", num: "Member 04", name: "Julian Alfred Fajanilag", tone: "border-accent/25 bg-accent/15 text-accent" },
  { initials: "RS", num: "Member 05", name: "Rodjomar Sioting", tone: "border-accent2/25 bg-accent2/15 text-accent2" },
  { initials: "ES", num: "Member 06", name: "Emmanuel Salazar", tone: "border-warn/25 bg-warn/15 text-warn" },
];

const QUICK_JUMP_LINKS = [
  { href: "#story", label: "Our Story" },
  { href: "#vision-mission", label: "Vision & Mission" },
  { href: "#values", label: "Core Values" },
  { href: "#sections", label: "Library Sections" },
  { href: "#guidelines", label: "Guidelines" },
  { href: "#fines", label: "Fines & Penalties" },
  { href: "#branches", label: "Hours & Branches" },
  { href: "#find-us", label: "Find Us" },
  { href: "#team", label: "Team" },
];

const KEY_FACTS = [
  { label: "Statutory Mandate", value: "R.A. 7743", sub: "Established 1994" },
  { label: "Main Library Hours", value: "Mon–Sat · 8AM–8PM", sub: "No Noon Break" },
  { label: "Reading Spaces", value: "8 Sections", sub: "Print, Digital & PWD" },
  { label: "Citywide Reach", value: "10 Branches", sub: "District & Reading Centers" },
];

export function AboutUsContent() {
  return (
    <div className="relative overflow-x-clip space-y-0">
      {/* HERO & QUICK-JUMP NAVIGATION */}
      <section className="relative px-5 pb-16 pt-10 md:px-10 md:pb-20 md:pt-14">
        {/* Ambient radial glows & subtle dot-grid */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/15 blur-[110px]" />
          <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-gold/10 blur-[110px]" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "radial-gradient(rgba(159,193,225,0.22) 1px, transparent 1.2px)",
              backgroundSize: "26px 26px",
              maskImage: "radial-gradient(ellipse 75% 65% at 50% 35%, #000 15%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 35%, #000 15%, transparent 80%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-[1060px] text-center">
          <Reveal direction="up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 font-mono text-[0.68rem] font-semibold tracking-[0.16em] text-gold uppercase backdrop-blur-md">
              <Building2 className="h-3.5 w-3.5" />
              Republic of the Philippines &middot; City Government of Iloilo
            </div>

            <h1 className="font-serif text-[clamp(2.2rem,4.5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-white">
              About <span className="text-gold">Iloilo City Public Library</span>
            </h1>

            <p className="mx-auto mt-4 max-w-[680px] text-[0.98rem] leading-[1.8] text-tl/85">
              Dr. Graciano Lopez Jaena Learning Resource Center and Museum — where civic heritage,
              knowledge, and community learning thrive in the heart of Iloilo City.
            </p>
          </Reveal>

          {/* 4-Item Glass Key Facts Strip */}
          <StaggerGroup className="mx-auto mt-10 grid max-w-[960px] grid-cols-2 gap-3.5 md:grid-cols-4">
            {KEY_FACTS.map((fact) => (
              <StaggerItem key={fact.label}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left backdrop-blur-md transition duration-200 hover:border-gold/30 hover:bg-white/[0.06]">
                  <div className="font-mono text-[0.64rem] font-semibold tracking-[0.12em] text-accent/80 uppercase">
                    {fact.label}
                  </div>
                  <div className="mt-1 font-serif text-lg font-bold tracking-tight text-white">
                    {fact.value}
                  </div>
                  <div className="mt-0.5 text-[0.75rem] text-tl/70">{fact.sub}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          {/* Smooth-scroll Quick-Jump Anchor Pills */}
          <Reveal direction="up" className="mt-8">
            <nav
              aria-label="About page sections"
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {QUICK_JUMP_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[0.78rem] font-medium text-tl/85 backdrop-blur-md transition duration-200 hover:border-gold/40 hover:bg-gold/12 hover:text-gold"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </Reveal>
        </div>
      </section>

      {/* WHO WE ARE */}
      <section id="story" className="scroll-mt-20 border-y border-white/8 bg-surface-deep/75 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1060px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              Heritage &amp; Mandate
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Who We <span className="text-accent">Are</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">Our story, our purpose.</p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Narrative Card (7 cols) */}
            <Reveal direction="slide" className="lg:col-span-7">
              <div className="h-full space-y-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 text-[0.92rem] leading-[1.85] text-tl backdrop-blur-md md:p-8">
                <p>
                  The Iloilo City Public Library, also known as the Dr. Graciano Lopez Jaena Learning
                  Resource Center and Museum, is housed at the Graciano Lopez Jaena Shrine on Fajardo
                  Street, Jaro, Iloilo City. The property is held by usufruct for 50 years, turned
                  over by the Dr. Graciano Lopez Jaena Foundation, Inc. to the City of Iloilo to
                  complete and manage the Lopez Jaena Shrine and Library that the Foundation had
                  started.
                </p>
                <p>
                  Named after the renowned Filipino propagandist and journalist, our institution
                  serves as the primary hub for learning, research, and community engagement —
                  providing equitable access to books, digital resources, periodicals, historical
                  artifacts, and inclusive collections that reflect the rich cultural heritage of the
                  Ilonggo people.
                </p>
                <p>
                  Our library is more than just a repository of books. It is a living, breathing
                  space where ideas flourish, communities connect, and the legacy of our past
                  inspires the innovations of our future. We are mandated under{" "}
                  <strong className="font-semibold text-white">Republic Act No. 7743</strong> (June
                  17, 1994) to provide public library services throughout the Philippines.
                </p>
              </div>
            </Reveal>

            {/* Legal Mandate + Location Callouts (5 cols) */}
            <Reveal direction="up" className="flex flex-col gap-5 lg:col-span-5">
              <div className="relative flex-1 overflow-hidden rounded-[22px] border border-gold/30 bg-gold/[0.06] p-6 backdrop-blur-md md:p-7">
                <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-gold to-accent" />
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
                  <Scale className="h-5 w-5" />
                </div>
                <div className="mb-1.5 font-mono text-[0.68rem] font-bold tracking-[0.14em] text-gold uppercase">
                  Legal Mandate
                </div>
                <h3 className="mb-2 font-serif text-lg font-bold text-white">
                  Republic Act No. 7743
                </h3>
                <p className="text-[0.85rem] leading-[1.75] text-tl/90">
                  An Act providing for the establishment of Congressional, City and Municipal
                  Libraries and Barangay Reading Centers throughout the Philippines, appropriating
                  the necessary funds therefor and for other purposes.
                </p>
              </div>

              <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md md:p-7">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/15 text-accent">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="mb-1 font-mono text-[0.68rem] font-bold tracking-[0.14em] text-accent uppercase">
                  Historic Shrine Location
                </div>
                <p className="text-[0.85rem] leading-[1.7] text-tl/90">
                  Graciano Lopez Jaena Shrine, Fajardo Street, Jaro, Iloilo City — held by 50-year
                  usufruct for public education and cultural preservation.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* VISION, MISSION & QUALITY POLICY */}
      <section id="vision-mission" className="scroll-mt-20 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1000px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              Direction &amp; Commitment
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Vision, Mission &amp; <span className="text-accent">Quality Policy</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              The principles that guide everything we do.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <StaggerItem>
              <div className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition duration-200 hover:border-gold/35 md:p-7">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-gold via-accent to-transparent" />
                <div className="mb-3 flex items-center gap-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-gold uppercase">
                  <Eye className="h-4 w-4" /> Our Vision
                </div>
                <p className="text-[0.89rem] leading-[1.8] text-tl/90">
                  The Iloilo City Public Library empowers Ilonggos through lifelong learning and
                  cultural preservation, cultivating information-literate and skilled citizens who
                  actively contribute to a livable, sustainable, and well-governed Iloilo with a
                  robust and inclusive economy.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition duration-200 hover:border-accent2/35 md:p-7">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent2 to-transparent" />
                <div className="mb-3 flex items-center gap-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent2 uppercase">
                  <Target className="h-4 w-4" /> Our Mission
                </div>
                <p className="text-[0.89rem] leading-[1.8] text-tl/90">
                  Provides inclusive and responsive services that empower the Ilonggo community
                  through equitable access to information and resources, preserving our cultural
                  heritage and fostering the development of a livable, sustainable, and resilient
                  city.
                </p>
              </div>
            </StaggerItem>
          </StaggerGroup>

          <Reveal direction="slide" className="mt-6">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md md:p-8">
              <div className="mb-5 flex items-center gap-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent uppercase">
                <ListChecks className="h-4 w-4" /> Quality Policy
              </div>
              <ul className="space-y-3">
                {QUALITY_POLICY_ITEMS.map((item, idx) => (
                  <li
                    key={item}
                    className="flex items-start gap-3.5 rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3 text-[0.88rem] leading-[1.65] text-tl/90"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/12 font-mono text-[0.68rem] font-bold text-accent">
                      0{idx + 1}
                    </span>
                    <span className="flex-1 pt-0.5">{item}</span>
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent2/80" />
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CORE VALUES */}
      <section id="values" className="scroll-mt-20 border-y border-white/8 bg-surface-deep/75 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              What Stands Beneath Our Service
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Our Core <span className="text-accent">Values</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              The ideals that direct us in service to our community.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_VALUES.map(({ icon: Icon, title, desc }) => (
              <StaggerItem key={title}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-gold/35 hover:bg-white/[0.06]">
                  <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold transition group-hover:bg-gold/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1.5 text-[0.95rem] font-bold text-white">{title}</h3>
                  <p className="text-[0.81rem] leading-[1.7] text-tl/85">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* LIBRARY SECTIONS */}
      <section id="sections" className="scroll-mt-20 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              Collections &amp; Spaces
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Library <span className="text-accent">Sections</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              Explore the diverse collections and spaces available to you.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LIBRARY_SECTIONS.map(({ icon: Icon, title, desc }) => (
              <StaggerItem key={title}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-gold/35 hover:bg-white/[0.06]">
                  <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/12 text-accent transition group-hover:bg-accent/22">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-[0.94rem] font-bold text-white">{title}</h3>
                  <p className="text-[0.8rem] leading-[1.7] text-tl/85">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* GENERAL GUIDELINES */}
      <section id="guidelines" className="scroll-mt-20 border-y border-white/8 bg-surface-deep/75 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1040px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              House Etiquette
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              General <span className="text-accent">Guidelines</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              Rules that help us maintain a safe and productive space for everyone.
            </p>
          </Reveal>

          <Reveal direction="up">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md md:p-8">
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {GENERAL_GUIDELINES.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[0.84rem] leading-[1.65] text-tl/90 transition duration-200 hover:border-accent/25 hover:bg-white/[0.05]"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FINES & PENALTIES */}
      <section id="fines" className="scroll-mt-20 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1000px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              Accountability
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Fines &amp; <span className="text-accent">Penalties</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              Policies to ensure fair use of our shared resources.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <StaggerItem>
              <div className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition duration-200 hover:border-warn/35">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-warn to-transparent" />
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/12 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-[0.1em] text-warn uppercase">
                  <Clock className="h-3 w-3" /> Overdue
                </div>
                <h3 className="mb-1 text-[0.98rem] font-bold text-white">Late Return</h3>
                <div className="my-2 font-mono text-2xl font-bold text-warn">
                  ₱{CIRCULATION_POLICY.DAILY_OVERDUE_FINE_PHP.toFixed(2)} / day
                </div>
                <p className="text-[0.82rem] leading-[1.7] text-tl/85">
                  A ₱{CIRCULATION_POLICY.DAILY_OVERDUE_FINE_PHP.toFixed(2)} charge per{" "}
                  {CIRCULATION_POLICY.FINE_DAY_MODE} day (grace period:{" "}
                  {CIRCULATION_POLICY.GRACE_PERIOD_DAYS} days, no cap) is applied for overdue
                  Circulation books.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition duration-200 hover:border-danger/35">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-danger to-transparent" />
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/12 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-[0.1em] text-danger uppercase">
                  <FileX2 className="h-3 w-3" /> Lost Book
                </div>
                <h3 className="mb-2 text-[0.98rem] font-bold text-white">Lost Materials</h3>
                <p className="text-[0.82rem] leading-[1.7] text-tl/85">
                  Immediately report the loss to the City Librarian, execute an Affidavit of Loss,
                  and replace the copy or pay its assessed equivalent as approved by the City
                  Librarian.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition duration-200 hover:border-accent/35">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent to-transparent" />
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-[0.1em] text-accent uppercase">
                  <Scissors className="h-3 w-3" /> Tampering
                </div>
                <h3 className="mb-2 text-[0.98rem] font-bold text-white">Damaged Materials</h3>
                <p className="text-[0.82rem] leading-[1.7] text-tl/85">
                  Tampered or torn materials require replacement or equivalent fee as
                  assessed and approved by the City Librarian.
                </p>
              </div>
            </StaggerItem>
          </StaggerGroup>
        </div>
      </section>

      {/* SERVICE HOURS & BRANCHES */}
      <section id="branches" className="scroll-mt-20 border-y border-white/8 bg-surface-deep/75 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1060px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              Schedules &amp; Locations
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Service Hours &amp; <span className="text-accent">Branches</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              We serve the community across multiple locations in Iloilo City.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Reveal direction="left" className="lg:col-span-5">
              <div className="h-full rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-[0.98rem] font-bold text-accent">
                    <Building2 className="h-4 w-4" /> Main Library
                  </h3>
                  <span className="rounded-full border border-accent2/30 bg-accent2/12 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold text-accent2 uppercase">
                    No Noon Break
                  </span>
                </div>
                <p className="mb-5 text-xs leading-relaxed text-tl/80">
                  Dr. Graciano Lopez Jaena Learning Resource Center, Fajardo St., Jaro, Iloilo City
                </p>
                <div className="divide-y divide-white/8 text-xs">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-white/65">Monday – Saturday</span>
                    <span className="font-semibold text-white">8:00 AM – 8:00 PM</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-white/65">Sunday &amp; Holidays</span>
                    <span className="font-semibold text-danger">Closed</span>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal direction="right" className="lg:col-span-7">
              <div className="h-full rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
                  <h3 className="flex items-center gap-2 text-[0.98rem] font-bold text-accent">
                    <MapPin className="h-4 w-4" /> District &amp; Community Branches
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/60">Mon – Fri:</span>
                    <span className="font-semibold text-white">8:00 AM – 5:00 PM</span>
                  </div>
                </div>
                <ul className="grid grid-cols-1 gap-x-4 gap-y-2 text-[0.8rem] text-tl/85 sm:grid-cols-2">
                  {DISTRICT_BRANCHES.map((branch) => (
                    <li key={branch} className="flex items-start gap-2 rounded-lg py-0.5">
                      <BookMarked className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/80" />
                      <span>{branch}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FIND US */}
      <section id="find-us" className="scroll-mt-20 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-10 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              Visit the Shrine
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Find <span className="text-accent">Us</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              We&apos;re right here in the heart of Iloilo City.
            </p>
          </Reveal>

          <Reveal direction="slide">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md md:p-7">
              <div className="overflow-hidden rounded-2xl border border-white/12 shadow-lg">
                <iframe
                  title="Iloilo City Public Library Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3920.0973746443183!2d122.55383718480495!3d10.726972612655242!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33aee57b1c3f8e21%3A0x1982b56223672f07!2sIloilo%20City%20Public%20Library!5e0!3m2!1sen!2sph!4v1769425464244!5m2!1sen!2sph"
                  width="100%"
                  height="420"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-gold/30">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <div>
                    <h3 className="mb-1 text-sm font-bold text-white">Address</h3>
                    <p className="text-xs leading-relaxed text-tl/85">
                      Graciano Lopez Jaena Shrine
                      <br />
                      Fajardo St., Jaro, Iloilo City, Philippines 5000
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-accent/30">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <h3 className="mb-1 text-sm font-bold text-white">Main Library Hours</h3>
                    <p className="text-xs leading-relaxed text-tl/85">
                      Monday – Saturday: 8:00 AM – 8:00 PM
                      <br />
                      Sunday &amp; Holidays: Closed
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-accent2/30">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent2" />
                  <div>
                    <h3 className="mb-1 text-sm font-bold text-white">Contact Information</h3>
                    <p className="text-xs leading-relaxed text-tl/85">
                      Phone: (033) 335-4078
                      <br />
                      Email: iloilocitypubliclibrary@gmail.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* MEET THE TEAM */}
      <section id="team" className="scroll-mt-20 border-t border-white/8 bg-surface-deep/75 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-8 text-center">
            <div className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold/85 uppercase">
              Engineering &amp; Design
            </div>
            <h2 className="font-serif text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold tracking-[-0.02em] text-white">
              Meet the <span className="text-accent">Team</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              The developers behind the Iloilo Public Library web application.
            </p>
          </Reveal>

          <Reveal direction="up" className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-3.5 rounded-full border border-gold/25 bg-gold/[0.08] px-6 py-2.5 backdrop-blur-md">
              <span className="bg-gradient-to-r from-gold via-accent to-accent2 bg-clip-text text-sm font-bold text-transparent">
                S+ Premium
              </span>
              <span className="h-4 w-px bg-white/15" />
              <span className="text-xs text-tl/75">Iloilo Public Library &middot; Web App</span>
            </div>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DEV_TEAM.map((member) => (
              <StaggerItem key={member.num}>
                <div className="flex flex-col gap-5 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-gold/35 hover:bg-white/[0.06]">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-base font-bold ${member.tone}`}
                    >
                      {member.initials}
                    </div>
                    <div>
                      <div className="font-mono text-[0.62rem] font-semibold tracking-[0.16em] text-accent/65 uppercase">
                        {member.num}
                      </div>
                      <div className="mt-0.5 text-[0.98rem] font-semibold text-white">
                        {member.name}
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-white/8" />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[0.68rem] font-medium text-accent/90">
                      <Code2 className="h-3.5 w-3.5" /> Developer
                    </span>
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <Reveal direction="up" className="mt-10 text-center">
            <div className="font-serif text-base font-semibold tracking-[0.08em] text-gold">
              S+ Premium
            </div>
            <div className="mt-1.5 font-mono text-[0.65rem] tracking-[0.16em] text-tl/50 uppercase">
              Designed &amp; developed with care for the Iloilo community.
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
