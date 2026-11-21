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
    desc: "Located on the 2nd floor of the building, this section manages the borrowing and returning of library materials. Up to 2 books may be loaned out for 3 days, with renewals available.",
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
    text: "A maximum of two (2) books are allowed for home reading for three (3) days. Books are renewable for loan-out.",
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

export function AboutUsContent() {
  return (
    <div className="space-y-0">
      {/* HERO */}
      <section className="mx-auto max-w-[760px] px-5 pb-14 pt-8 text-center md:px-10 md:pb-16">
        <Reveal direction="up">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/12 px-3.5 py-1 font-mono text-[0.72rem] font-bold tracking-[0.12em] text-accent uppercase">
            <Building2 className="h-3.5 w-3.5" /> About the Library
          </div>
          <h1 className="mb-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-tight tracking-[-0.03em] text-white">
            About <span className="text-accent">Us</span>
          </h1>
          <p className="mx-auto max-w-[660px] text-[0.95rem] leading-[1.8] text-tl/85">
            Dr. Graciano Lopez Jaena Learning Resource Center and Museum — where stories come to
            life in the heart of Iloilo City.
          </p>
        </Reveal>
      </section>

      {/* WHO WE ARE */}
      <section className="border-y border-white/8 bg-[#121e2b]/60 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[920px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Who We <span className="text-accent">Are</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">Our story, our purpose.</p>
          </Reveal>

          <Reveal direction="slide">
            <div className="space-y-4 rounded-[22px] border border-white/10 bg-card-glass p-6 text-[0.92rem] leading-[1.85] text-tl backdrop-blur-sm md:p-9">
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

          <Reveal direction="up" className="mt-6">
            <div className="relative flex items-start gap-4 overflow-hidden rounded-[20px] border border-accent/25 bg-accent/10 p-6 backdrop-blur-sm md:p-7">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent to-accent2" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/15 text-accent">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <div className="mb-1 font-mono text-[0.68rem] font-bold tracking-[0.14em] text-accent uppercase">
                  Legal Mandate
                </div>
                <p className="text-[0.86rem] leading-[1.75] text-tl/90">
                  Republic Act No. 7743 — An Act providing for the establishment of Congressional,
                  City and Municipal Libraries and Barangay Reading Centers throughout the
                  Philippines, appropriating the necessary funds therefor and for other purposes.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* VISION, MISSION & QUALITY POLICY */}
      <section className="px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[920px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Vision, Mission &amp; <span className="text-accent">Quality Policy</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              The principles that guide everything we do.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <StaggerItem>
              <div className="relative h-full overflow-hidden rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm md:p-7">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent to-transparent" />
                <div className="mb-3 flex items-center gap-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent uppercase">
                  <Eye className="h-4 w-4" /> Our Vision
                </div>
                <p className="text-[0.88rem] leading-[1.8] text-tl/90">
                  The Iloilo City Public Library empowers Ilonggos through lifelong learning and
                  cultural preservation, cultivating information-literate and skilled citizens who
                  actively contribute to a livable, sustainable, and well-governed Iloilo with a
                  robust and inclusive economy.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="relative h-full overflow-hidden rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm md:p-7">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent2 to-transparent" />
                <div className="mb-3 flex items-center gap-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent2 uppercase">
                  <Target className="h-4 w-4" /> Our Mission
                </div>
                <p className="text-[0.88rem] leading-[1.8] text-tl/90">
                  Provides inclusive and responsive services that empower the Ilonggo community
                  through equitable access to information and resources, preserving our cultural
                  heritage and fostering the development of a livable, sustainable, and resilient
                  city.
                </p>
              </div>
            </StaggerItem>
          </StaggerGroup>

          <Reveal direction="slide" className="mt-6">
            <div className="rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm md:p-7">
              <div className="mb-4 flex items-center gap-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent uppercase">
                <ListChecks className="h-4 w-4" /> Quality Policy
              </div>
              <ul className="space-y-3">
                {QUALITY_POLICY_ITEMS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[0.88rem] leading-[1.65] text-tl/90"
                  >
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CORE VALUES */}
      <section className="border-y border-white/8 bg-[#121e2b]/60 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Our Core <span className="text-accent">Values</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              The ideals that direct us in service to our community.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_VALUES.map(({ icon: Icon, title, desc }) => (
              <StaggerItem key={title}>
                <div className="group h-full rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:border-accent/35 hover:bg-card-glass-hover">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/12 text-accent transition group-hover:bg-accent/22">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1.5 text-[0.94rem] font-bold text-white">{title}</h3>
                  <p className="text-[0.8rem] leading-[1.7] text-tl/85">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* LIBRARY SECTIONS */}
      <section className="px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Library <span className="text-accent">Sections</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              Explore the diverse collections and spaces available to you.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LIBRARY_SECTIONS.map(({ icon: Icon, title, desc }) => (
              <StaggerItem key={title}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:border-accent/35 hover:bg-card-glass-hover">
                  <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/12 text-accent transition group-hover:bg-accent/22">
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
      <section className="border-y border-white/8 bg-[#121e2b]/60 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[920px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              General <span className="text-accent">Guidelines</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              Rules that help us maintain a safe and productive space for everyone.
            </p>
          </Reveal>

          <Reveal direction="up">
            <div className="rounded-[22px] border border-white/10 bg-card-glass p-5 backdrop-blur-sm md:p-8">
              <ul className="space-y-2.5">
                {GENERAL_GUIDELINES.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3 text-[0.86rem] leading-[1.65] text-tl/90"
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
      <section className="px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[920px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Fines &amp; <span className="text-accent">Penalties</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              Policies to ensure fair use of our shared resources.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <StaggerItem>
              <div className="h-full rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/12 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-[0.1em] text-warn uppercase">
                  <Clock className="h-3 w-3" /> Overdue
                </div>
                <h3 className="mb-1 text-[0.95rem] font-bold text-white">Late Return</h3>
                <div className="my-2 font-mono text-xl font-bold text-warn">₱10.00 / day</div>
                <p className="text-[0.82rem] leading-[1.7] text-tl/85">
                  A ten-peso charge per day is applied for every overdue book from the Circulation
                  section. Counting covers working days only, excluding holidays.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="h-full rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/12 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-[0.1em] text-danger uppercase">
                  <FileX2 className="h-3 w-3" /> Lost Book
                </div>
                <h3 className="mb-2 text-[0.95rem] font-bold text-white">Lost Materials</h3>
                <p className="text-[0.82rem] leading-[1.7] text-tl/85">
                  Immediately report the loss to the City Librarian and execute an Affidavit of
                  Loss. The book may be replaced with the same copy/edition, the current/updated
                  edition, or a related title as assessed and approved by the City Librarian,
                  subject to Commission on Audit rules.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="h-full rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-[0.1em] text-accent uppercase">
                  <Scissors className="h-3 w-3" /> Tampering
                </div>
                <h3 className="mb-2 text-[0.95rem] font-bold text-white">Damaged Materials</h3>
                <p className="text-[0.82rem] leading-[1.7] text-tl/85">
                  Tampered or torn materials will be confiscated by the City Librarian. The
                  borrower must replace the item with the same title, updated edition, or a
                  related subject title as approved by the City Librarian.
                </p>
              </div>
            </StaggerItem>
          </StaggerGroup>
        </div>
      </section>

      {/* SERVICE HOURS & BRANCHES */}
      <section className="border-y border-white/8 bg-[#121e2b]/60 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1000px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Service Hours &amp; <span className="text-accent">Branches</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              We serve the community across multiple locations in Iloilo City.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Reveal direction="left">
              <div className="h-full rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm">
                <h3 className="mb-2 flex items-center gap-2 text-[0.95rem] font-bold text-accent">
                  <Building2 className="h-4 w-4" /> Main Library
                </h3>
                <p className="mb-4 text-xs leading-relaxed text-tl/80">
                  Dr. Graciano Lopez Jaena Learning Resource Center, Fajardo St., Jaro, Iloilo City
                </p>
                <div className="divide-y divide-white/6 text-xs">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-white/60">Monday – Saturday</span>
                    <span className="font-semibold text-white">8:00 AM – 8:00 PM</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-white/60">Sunday &amp; Holidays</span>
                    <span className="font-semibold text-danger">Closed</span>
                  </div>
                </div>
                <p className="mt-3 text-[0.74rem] text-white/40">No Noon Break</p>
              </div>
            </Reveal>

            <Reveal direction="right">
              <div className="h-full rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm">
                <h3 className="mb-2 flex items-center gap-2 text-[0.95rem] font-bold text-accent">
                  <MapPin className="h-4 w-4" /> District &amp; Community Branches
                </h3>
                <div className="mb-3 flex items-center justify-between border-b border-white/6 pb-2.5 text-xs">
                  <span className="text-white/60">Monday – Friday</span>
                  <span className="font-semibold text-white">8:00 AM – 5:00 PM</span>
                </div>
                <ul className="space-y-1.5 text-[0.8rem] text-tl/85">
                  {DISTRICT_BRANCHES.map((branch) => (
                    <li key={branch} className="flex items-start gap-2">
                      <BookMarked className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/75" />
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
      <section className="px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-10 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Find <span className="text-accent">Us</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              We&apos;re right here in the heart of Iloilo City.
            </p>
          </Reveal>

          <Reveal direction="slide">
            <div className="rounded-[22px] border border-white/10 bg-card-glass p-5 backdrop-blur-sm md:p-7">
              <div className="overflow-hidden rounded-xl border border-white/10 shadow-lg">
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
                <div className="flex items-start gap-3.5 rounded-2xl border border-white/8 bg-white/[0.04] p-5">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <h3 className="mb-1 text-sm font-bold text-white">Address</h3>
                    <p className="text-xs leading-relaxed text-tl/85">
                      Graciano Lopez Jaena Shrine
                      <br />
                      Fajardo St., Jaro, Iloilo City, Philippines 5000
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/8 bg-white/[0.04] p-5">
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

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/8 bg-white/[0.04] p-5">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
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
      <section className="border-t border-white/8 bg-[#121e2b]/60 px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="up" className="mb-8 text-center">
            <h2 className="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-[-0.02em] text-white">
              Meet the <span className="text-accent">Team</span>
            </h2>
            <p className="mt-1.5 text-[0.88rem] text-tl/80">
              The developers behind the Iloilo Public Library web application.
            </p>
          </Reveal>

          <Reveal direction="up" className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-3.5 rounded-2xl border border-accent/25 bg-accent/10 px-6 py-3">
              <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-base font-bold text-transparent">
                S+ Premium
              </span>
              <span className="h-5 w-px bg-white/15" />
              <span className="text-xs text-white/55">Iloilo Public Library · Web App</span>
            </div>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DEV_TEAM.map((member) => (
              <StaggerItem key={member.num}>
                <div className="flex flex-col gap-5 rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:bg-card-glass-hover">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-base font-bold ${member.tone}`}
                    >
                      {member.initials}
                    </div>
                    <div>
                      <div className="font-mono text-[0.62rem] font-semibold tracking-[0.16em] text-accent/55 uppercase">
                        {member.num}
                      </div>
                      <div className="mt-0.5 text-[0.98rem] font-semibold text-white">
                        {member.name}
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-white/6" />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[0.68rem] font-medium text-accent/80">
                      <Code2 className="h-3.5 w-3.5" /> Developer
                    </span>
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <Reveal direction="up" className="mt-10 text-center">
            <div className="text-sm font-semibold tracking-[0.1em] text-accent">S+ Premium</div>
            <div className="mt-1.5 font-mono text-[0.65rem] tracking-[0.16em] text-accent/40 uppercase">
              Designed &amp; developed with care for the Iloilo community.
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
