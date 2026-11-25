import { currentFrames } from './current-stories.js';

export const frames = {
  ...currentFrames(2, {
    "vuokravakuus-versions": {
      step: "Where 14 days came from",
      tag: "Draft to law",
      title: "The draft’s 30 days became 14",
      lead: "A Ministry of Justice working group paired a longer deadline with standard compensation. After consultation, the government chose a shorter deadline.",
      chart: { rows: [
        ["December 2024","Working group report","30 days and standard compensation"],
        ["March 2026","Bill introduced","14 days"],
        ["20 May 2026","Environment Committee","14 days retained"],
        ["16 June 2026","Act signed","14 days retained"]
      ] },
      notes: ["The proposed standard compensation would have become payable after the deadline without proof of actual loss."],
      more: ["The government argued that the deposit can be a substantial sum for a tenant. The enacted law allows compensation for loss caused by unjustified withholding."],
      sources: [
        "Government bill, section 6 and reasons for section 8",
        "Environment Committee report YmVM 8/2026, deposit section",
        "Act 531/2026, section 8"
      ],
      terms: [["Standard compensation","A set payment that does not depend on the exact loss suffered."]]
    },
    "vuokravakuus-submissions": {
      step: "Who wanted a shorter deadline",
      tag: "Consultation",
      title: "Tenant and landlord representatives backed different deadlines",
      lead: "The government’s summary records disagreement about how long landlords should have and what should happen when repayment is late.",
      chart: { rows: [
        ["Tenant representatives","Favoured a shorter period. They feared that 30 days would become the usual wait."],
        ["Landlord representatives","Supported the working group’s 30-day deadline."]
      ] },
      notes: ["Some respondents saw standard compensation as protection for tenants. Others argued that it would be difficult to interpret and could generate disputes."],
      more: ["The government says it revised the bill following the consultation. Its summary records the positions of groups. The part played by any one submission remains open."],
      sources: [
        "Government bill, section 6: consultation feedback",
        "Environment Committee report, deposit section"
      ],
      terms: [["Consultation","A stage when a ministry asks for feedback on a draft before the government introduces a bill."]]
    },
    "vuokravakuus-deadline": {
      step: "How the days are counted",
      tag: "Worked example",
      title: "A Monday handover makes Tuesday day one",
      lead: "Imagine the lease ends on 4 October 2026 and the tenant hands the property back the next day.",
      chart: { rows: [
        ["5 October 2026","Property handed back","The handover day is excluded"],
        ["6 October 2026","Day one","The 14-day count starts"],
        ["19 October 2026","Day fourteen","Last day in this example"]
      ] },
      notes: ["The Environment Committee clarified that the count begins the day after the lease ends or the property is handed back, if later."],
      more: ["The deposit is due without delay. The date in the example is the outer limit where there is no valid obstacle to repayment or notice."],
      sources: [
        "Environment Committee report, how to count the days",
        "Time Limits Act 150/1930, sections 2 and 5",
        "Act 531/2026, section 8"
      ],
      terms: [["Handing back possession","Returning the property to the landlord’s control, for example by handing back the keys."]]
    },
    "vuokravakuus-notice-period": {
      step: "What else changed",
      tag: "Notice periods",
      title: "The date a lease was signed can change the notice period",
      lead: "The same reform changed notice periods when landlords end open-ended leases.",
      chart: { rows: [
        ["Lease signed before 1 October 2026","6 months if the tenancy has lasted at least one year"],
        ["New lease from 1 October 2026","4 months if the tenancy has lasted at least two years"]
      ] },
      notes: ["In other cases, the landlord gives three months’ notice. The tenant’s notice period remains one month."],
      more: ["Parties to an older lease can agree to apply the new notice rule after the law comes into force. The deposit repayment rule already covers older leases."],
      sources: [
        "Act 531/2026, section 52 and commencement provision",
        "Ministry of Justice announcement, 29 September 2026"
      ],
      terms: [["Open-ended lease","A lease that continues until it ends, for example when one party gives notice."]]
    },
    "saastovapaa-before-and-after": {
      step: "Notice becomes a request",
      tag: "Previous and new rules",
      title: "The four-month deadline stays and employers gain a say",
      lead: "The starting point has been for the worker and employer to agree on dates. The amendment changes what happens when they cannot agree.",
      chart: { rows: [
        ["Former section 27","The worker gave four months’ notice of the dates"],
        ["New section 27a","The worker requests the dates four months ahead"]
      ] },
      notes: ["The employer must now give a reasoned reply within a month. The law specifies the grounds on which the employer can refuse."],
      more: ["Saving days and choosing dates are governed separately. Section 27 generally lets workers save leave above 24 weekdays. The parties can agree to save the part above 18 days."],
      sources: [
        "Annual Holidays Act, former section 27 and new section 27a",
        "Government bill, sections 2 and 7"
      ],
      terms: [["Section 27a","The new section on agreeing, requesting and responding to dates for carried-over leave."]]
    },
    "saastovapaa-submissions": {
      step: "What respondents asked for",
      tag: "Consultation",
      title: "The right to refuse divided respondents",
      lead: "The government’s consultation summary records different views from employer and employee representatives.",
      chart: { rows: [
        ["Employer representatives","Wanted greater control over dates. The Federation of Finnish Enterprises repeated that position to the committee in September."],
        ["SAK","Opposed the change. If it passed, SAK wanted a serious disruption threshold and a limit on repeated refusals."]
      ] },
      notes: ["The Chancellor of Justice noted that the draft put the ordinary work arrangements requirement in the explanatory text. The bill put it in the section itself."],
      more: ["The final law permits refusal where ordinary work arrangements cannot avoid disruption to production or services, or where fair scheduling of holidays and carried-over leave would be prevented."],
      sources: [
        "Government bill, section 6.2: consultation feedback",
        "Federation of Finnish Enterprises submission, 10 September 2026",
        "SAK submission to Parliament, pp. 1–2",
        "Annual Holidays Act, section 27a"
      ],
      terms: [["Reasons for a section","The government’s explanation of why it chose particular wording and how it intends the section to work."]]
    },
    "saastovapaa-decision": {
      step: "How Parliament decided",
      tag: "Parliament",
      title: "The package passed 109–53",
      lead: "The committee majority backed the change. Four MPs filed a dissent asking Parliament to reject the bill on carried-over leave.",
      chart: { rows: [
        ["16 June 2026","Government bill","New section 27a"],
        ["25 September 2026","Committee report","Grounds for refusal retained"],
        ["7 October 2026","Second reading","109 for approval, 53 against"],
        ["1 January 2027","Commencement","New rule on dates takes effect"]
      ] },
      notes: ["The dissent argued that the bill did not establish that the earlier system had caused significant problems."],
      more: ["The vote was on passing or rejecting the bills. The package included four amendments to other laws alongside the Annual Holidays Act."],
      sources: [
        "Employment and Equality Committee report TyVM 6/2026 and dissent",
        "Parliamentary vote, 7 October 2026",
        "Annual Holidays Act amendment 943/2026, commencement"
      ],
      terms: [["Dissent","An alternative position by committee members, published with the committee’s report."]]
    },
    "saastovapaa-worked-example": {
      step: "How the transition works",
      tag: "Worked example",
      title: "October leave can still follow the old rule",
      lead: "A worker saved days in 2026 without agreeing dates and wants to take them on 4–8 October 2027.",
      chart: { rows: [
        ["4 June 2027","Last notification day in this example"],
        ["4 October 2027","Leave starts and ends before 31 October"]
      ] },
      notes: ["The worker can use the old notice procedure because the leave ends within the transition period and they can give four months’ notice."],
      more: ["For leave in November, the new request procedure applies. Dates already agreed before the year ends remain as agreed."],
      sources: [
        "Annual Holidays Act amendment 943/2026, transition provision",
        "Government bill, section 8: commencement"
      ],
      terms: [["Transition period","Here, the time after the change takes effect during which some previously saved leave can still follow the old notice rule."]]
    },
    "yleistuki-old-benefits": {
      step: "How the old benefits differed",
      tag: "Before the reform",
      title: "The same pension could affect two benefits differently",
      lead: "A partial early old-age pension illustrates what changed when two Kela benefits became one.",
      chart: { rows: [
        ["Basic unemployment allowance","There was no means test. This pension did not reduce the allowance."],
        ["Labour market subsidy","The pension generally counted as income. An exception applied to some people aged 55 or over."]
      ] },
      notes: ["The new benefit has a means test. This pension could reduce it for people whose previous unemployment benefit was unaffected."],
      more: ["The Social Affairs and Health Committee pointed to this difference when it considered the autumn amendment. Pension recipients have three months from the date of the decision to cancel it."],
      sources: [
        "Social Affairs and Health Committee report StVM 15/2026, reasons",
        "General Social Security Benefit Act, sections 15–17",
        "Kela announcement, 22 October 2026, previous benefit rules"
      ],
      terms: [["Partial early old-age pension","Part of an accrued earnings-related pension that can be paid before the person takes their full old-age pension."]]
    },
    "yleistuki-pension-cutoff": {
      step: "Why the cutoff moved",
      tag: "Bill to law",
      title: "The committee moved the pension cutoff to May",
      lead: "The government proposed protecting pension decisions issued before the benefit law was signed. The committee used the date the law took effect.",
      chart: { rows: [
        ["16 January 2026","Cutoff in the government bill"],
        ["1 May 2026","Cutoff in the committee report and enacted law"]
      ] },
      notes: ["Experts told the committee that pension providers learned of the impact late. A mid-January cutoff could also treat people who applied in the same month differently."],
      more: ["The committee cited evidence from its hearings when it moved the cutoff. The enacted exception covers pension decisions issued before May."],
      sources: [
        "Government bill HE 124/2026, proposed cutoff and reasons",
        "Committee report StVM 15/2026, expert evidence and proposed amendment",
        "General Social Security Benefit Act, section 55 and amendment 934/2026"
      ],
      terms: [["Cutoff date","The date used to compare pension decisions. A decision issued on 1 May falls on the later side of the cutoff."]]
    },
    "yleistuki-pension-votes": {
      step: "What Parliament voted on",
      tag: "Two votes",
      title: "Parliament chose the wording, then passed the change",
      lead: "MPs voted on the pension amendment at both readings. A yes vote meant something different each day.",
      chart: { rows: [
        ["16 October 2026","Basis for consideration","93 for the committee report, 81 for the dissenting proposal"],
        ["21 October 2026","Pass the bill","127 in favour, 48 against"],
        ["2 November 2026","Commencement","Applies retroactively from 1 May 2026"]
      ] },
      notes: ["On 16 October a yes vote backed the committee report. On 21 October it meant passing the bill."],
      more: [
        "The dissent proposed excluding partial early old-age pensions from the means test altogether. Its authors pointed to the aims of the 2017 pension reform.",
        "The exception Parliament passed depends on the date of the pension decision. Kela applies it retroactively from the day the new benefit started."
      ],
      sources: [
        "First-reading vote, 16 October 2026",
        "Second-reading vote, 21 October 2026",
        "Committee report StVM 15/2026, dissenting proposal",
        "Ministry of Social Affairs and Health announcement, 29 October 2026"
      ],
      terms: [["Retroactive application","Applying an amendment to a period before it came into force."]]
    },
    "yleistuki-pension-example": {
      step: "Which date matters",
      tag: "Worked example",
      title: "Two pensions starting in June can be treated differently",
      lead: "Imagine two people start drawing partial pensions in June. Their pension decisions were issued on different dates.",
      chart: { rows: [
        ["Decision on 30 April 2026","The pension is excluded from the means test"],
        ["Decision on 5 May 2026","The pension counts as income under the means test"]
      ] },
      notes: ["The date the pension decision was issued determines the outcome. Payments can start in the same month in both cases."],
      more: ["On 11 November 2026 Kela reported correcting about 3,000 benefit decisions. It made the corrections automatically where a pension covered by the exception had counted as income."],
      sources: [
        "Kela announcement on corrected decisions, 11 November 2026",
        "General Social Security Benefit Act, section 55"
      ],
      terms: [["Correction","Kela revises an earlier decision and pays any amount owed."]]
    },
    "digihenkkarit-age-proof": {
      step: "What a service receives",
      tag: "Privacy",
      title: "A service can check the age limit without a date of birth",
      lead: "Imagine a service only needs to know whether its user is an adult. The proof of age can answer that specific question.",
      chart: { rows: [
        ["Service checks identity","It may need a name and other identifying details"],
        ["Service checks the age limit","Proof of age can show the user is 18 or over"]
      ] },
      notes: ["The age proof is derived from information the authorities have verified. EU rules require wallets to support selective disclosure."],
      more: ["An online service that wants to receive wallet data registers its intended use and specifies the information it plans to request."],
      sources: [
        "Digital Identity Document Act, sections 2 and 4",
        "EU eIDAS amendment, articles 5a(4) and 5b",
        "Administration Committee report HaVM 15/2026, minors"
      ],
      terms: [["Selective disclosure","Sharing only part of the information in a credential with a service."]]
    },
    "digihenkkarit-age-limit": {
      step: "Where the age of 13 came from",
      tag: "Minors",
      title: "Children can set up the wallet themselves from age 13",
      lead: "The EU wallet rules leave the setup age to national rules. Finland’s government proposed 13 and the Administration Committee supported it.",
      chart: { rows: [
        ["Aged 13 and over","A young person can set up the wallet independently."],
        ["Under 13","A guardian’s consent is required for setup."]
      ] },
      notes: ["The government drew on the Data Protection Act’s age of 13 for a child’s consent to online services."],
      more: ["The committee saw age credentials as a way to support safer use. For some services all that matters is whether the user is in a particular age group."],
      sources: [
        "Act 810/2026, section 10",
        "Government bill, reasons for section 10 and consultation feedback",
        "Administration Committee report, minors"
      ],
      terms: [["Setup","Activating the wallet. Individual services can have their own age limits."]]
    },
    "digihenkkarit-accessibility": {
      step: "What if someone needs help",
      tag: "Accessibility",
      title: "Committees examined personal assistance and other ways to access services",
      lead: "In consultation, the Non-Discrimination Ombudsman drew attention to people who need a personal assistant to use the wallet.",
      chart: { rows: [
        ["Constitutional Law Committee","Wanted an alternative digital route to be available at least for public authorities’ services."],
        ["Administration Committee","Pointed to EU rules on accessibility, voluntary use and keeping other identification methods available."]
      ] },
      notes: ["The issue came up because the wallet rules require careful use and make it personal to the holder."],
      more: ["Under EU rules, people who choose to go without a wallet must still be able to access public and private services through existing identification methods."],
      sources: [
        "Government bill, sections 6 and 12.1",
        "Constitutional Law Committee opinion PeVL 32/2026, paragraphs 21–23",
        "Administration Committee report, accessibility and voluntary use",
        "eIDAS amendment, articles 5a(15) and 5a(21)"
      ],
      terms: [["Voluntary use","Going without the wallet must leave people with the same access to services."]]
    },
    "digihenkkarit-versions": {
      step: "How the project progressed",
      tag: "EU to Finland",
      title: "The law took effect ahead of the wallet launch",
      lead: "The EU set common rules for wallets. Finland’s laws assigned responsibilities and laid down the conditions for getting a digital ID.",
      chart: { rows: [
        ["April 2024","EU regulation","Common framework for wallets"],
        ["22 June 2026","Parliament’s second reading","Legislative package passed"],
        ["1 October 2026","Laws take effect","Rules for the digital ID come into force"],
        ["Late 2027","Suomi.fi schedule","Planned wallet launch"]
      ] },
      notes: ["The police or another competent authority grants the right to a digital ID. The Digital and Population Data Services Agency provides the credential for the wallet and runs the Suomi.fi wallet."],
      more: ["Traficom supervises wallet providers and keeps a register of services that rely on them. The law’s commencement and the app’s scheduled release are separate milestones."],
      sources: [
        "EU eIDAS amendment 2024/1183",
        "Parliament minutes PTK 70/2026, second reading",
        "Digital Identity Document Act, sections 7 and 15",
        "Act 810/2026, sections 7 and 16",
        "Digital and Population Data Services Agency, Suomi.fi wallet schedule"
      ],
      terms: [["eIDAS","The EU’s shared rules for electronic identification, digital wallets and electronic trust services."]]
    }
  }),
  "sports-intro": {
    "step": "What the law does",
    "tag": "In force since 1 July 2026",
    "title": "New pension options for athletes",
    "lead": "Finland changed the rules for sports clubs and paid athletes to address a shortage of pension insurance.",
    "chart": {
      "caption": "",
      "rows": [
        [
          "Existing option",
          "Savings earn interest"
        ],
        [
          "New option",
          "Savings tied to investments"
        ]
      ]
    },
    "notes": [
      "Clubs usually arrange the insurance for athletes who meet a minimum earnings threshold. With the new option, the value of the savings depends on how the investments perform."
    ],
    "more": [
      "A pension insurer stopped offering this cover at the end of 2025. The remaining provider offered policies to a limited group, leaving many athletes at risk of going without pension insurance.",
      "The government said the market had moved towards policies tied to investments. It expected the change to encourage more insurers to offer cover."
    ],
    "sources": [
      "Act 594/2026, § 14 and start date",
      "Government bill, pp. 2–3, why the law changed",
      "Health ministry’s summary of the law",
      "Parliament’s list of document abbreviations (PDF)",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "HE … vp",
        "Hallituksen esitys (HE) means government bill. Valtiopäivät (vp) is the parliamentary session. Together with the number and year, these identify the bill in Parliament’s records."
      ],
      [
        "Pension insurance",
        "A policy that builds savings to pay income in retirement."
      ],
      [
        "Investment-linked pension",
        "A pension policy whose savings rise or fall with the investments they are linked to."
      ],
      [
        "Earnings threshold",
        "The minimum level of pay in the legal test for whether a club must insure an athlete."
      ]
    ]
  },
  "sports-outcome": {
    "step": "Who gets notice",
    "tag": "Who gets notice",
    "title": "Clubs that buy cover get notice",
    "lead": "If an insurer plans to cut back or stop offering sports insurance, it must tell the policyholder. That’s who took out the insurance, often the athlete’s club.",
    "chart": {
      "caption": "Who the insurer must tell",
      "rows": [
        [
          "Before",
          "Health ministry"
        ],
        [
          "Now",
          "Health ministry",
          "Policyholder"
        ]
      ]
    },
    "notes": [
      "The duty applies to insurance under the sports law, which covers injuries as well as retirement. A club that gets a warning can use the time to look for another insurer."
    ],
    "more": [
      "When a club buys a policy for a player, the club holds the policy and the player is insured. An eligible individual athlete can also choose to buy their own policy and hold both roles.",
      "Section 16 a uses the insurance contract to determine who gets the new notice."
    ],
    "sources": [
      "Previous law, Act 230/2016, § 16 a",
      "Act 594/2026, § 16 a",
      "Government bill, § 2.1 on who buys the insurance"
    ],
    "terms": [
      [
        "Policyholder",
        "The person or organisation that took out the insurance. When a club buys cover for a player, the club holds the policy and the player is insured."
      ],
      [
        "Insured athlete",
        "The athlete whose retirement or injury cover the policy provides."
      ],
      [
        "§ 16 a",
        "Section 16 a of the sports insurance law. It sets out when insurers must give notice about limiting or stopping this cover and who receives it."
      ],
      [
        "Health ministry (STM)",
        "Finland’s Ministry of Social Affairs and Health, or Sosiaali- ja terveysministeriö in Finnish. It prepared the sports insurance bill."
      ]
    ]
  },
  "sports-requests": {
    "step": "What players asked for",
    "tag": "Formal submissions",
    "title": "Players asked for more warning",
    "lead": "Finland’s football players’ association (JPY) wrote to the ministry and to Parliament.",
    "chart": {
      "rows": [
        [
          "How much warning",
          "At least two years’ notice"
        ],
        [
          "Who else to tell",
          "Groups that represent policyholders and athletes, such as leagues or players’ associations"
        ]
      ]
    },
    "notes": [
      "The association first sent its proposals in March, while the ministry was taking feedback on the draft. It repeated them in May for Parliament’s Social Affairs and Health Committee."
    ],
    "more": [
      "JPY said Finland could no longer rely on one provider for athletes’ retirement cover. Its March submission called for at least two years’ warning to the ministry, with notice also going to the relevant leagues, sports federations and players’ associations.",
      "The Finnish ice hockey players’ association also backed a longer deadline and notice to representative bodies."
    ],
    "sources": [
      "JPY’s ministry submission, 6 March, p. 1",
      "JPY’s committee submission, 12 May hearing, item 1",
      "Ministry consultation, responses from football and ice hockey players’ associations",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "JPY",
        "Jalkapallon Pelaajayhdistys, the association that represents football players in Finland."
      ],
      [
        "Formal submission",
        "A written response filed with a ministry during consultation or with a parliamentary committee examining the bill."
      ],
      [
        "Representative body",
        "A group that speaks for other people or organisations, such as a league, sports federation or players’ association."
      ],
      [
        "Social Affairs and Health Committee (StV)",
        "The parliamentary committee that heard experts on this bill and reported to Parliament on its wording."
      ]
    ]
  },
  "sports-deadline": {
    "step": "When notice is due",
    "tag": "The deadline",
    "title": "The 31 December deadline stayed",
    "lead": "Insurers must give notice by the end of the year for changes they plan to make after the end of the following year.",
    "chart": {
      "caption": "Example",
      "rows": [
        [
          "31 Dec 2026",
          "Notice is due"
        ],
        [
          "1 Jan 2028",
          "Insurer plans to stop offering cover"
        ]
      ]
    },
    "notes": [
      "In this example, all of 2027 falls between the deadline to give notice and the planned withdrawal. The insurer must tell both the ministry and policyholders by that deadline."
    ],
    "more": [
      "Suppose the insurer plans to stop offering cover on 31 December 2028. The deadline is still the end of 2026. If the planned withdrawal moves to 1 January 2029, the deadline moves to 31 December 2027.",
      "JPY wanted at least two years’ warning. Parliament kept the calendar-year rule when it added the policyholder to the notice list."
    ],
    "sources": [
      "Previous law, Act 230/2016, § 16 a",
      "Act 594/2026, § 16 a",
      "JPY’s ministry submission, 6 March, p. 1"
    ],
    "terms": [
      [
        "Notice",
        "Advance warning that an insurer plans to limit or stop offering the cover governed by the sports insurance law."
      ],
      [
        "Calendar year",
        "The period from 1 January to 31 December. The notice rule uses the end of the calendar year."
      ],
      [
        "Policyholder",
        "The person or organisation that took out the insurance. When a club buys cover for a player, the club holds the policy and the player is insured."
      ],
      [
        "JPY",
        "Jalkapallon Pelaajayhdistys, the association that represents football players in Finland."
      ]
    ]
  },
  "sports-versions": {
    "step": "When the wording changed",
    "tag": "The bill in Parliament",
    "title": "The committee added policyholders",
    "lead": "The ministry had been the only recipient since 2016.",
    "chart": {
      "rows": [
        [
          "Feb 2026",
          "Ministry draft",
          "Notice goes to the ministry"
        ],
        [
          "16 Apr 2026",
          "Bill enters Parliament",
          "Existing notice rule stays"
        ],
        [
          "2 Jun 2026",
          "Committee report",
          "Adds the policyholder"
        ],
        [
          "26 Jun 2026",
          "Signed law",
          "Keeps both recipients"
        ]
      ]
    },
    "notes": [
      "The April bill dealt with how athletes’ pensions could be arranged. The committee’s report is the first of the official versions reviewed here to add the policyholder to the notice rule."
    ],
    "more": [
      "In February, the ministry was considering a separate pension fund as another way to arrange cover. Its draft would also have required that fund to give notice if it planned to limit or stop offering cover.",
      "The government dropped the fund before sending the bill to Parliament. Parliament later adopted the committee’s wording on who gets notice."
    ],
    "sources": [
      "Previous law, Act 230/2016, § 16 a",
      "Ministry’s February draft, § 16 a (Word)",
      "Introduced bill, draft law and § 6",
      "Committee report, StVM 7/2026 vp, proposed § 16 a",
      "Act 594/2026, § 16 a",
      "Parliament’s adopted wording, EV 83/2026 vp"
    ],
    "terms": [
      [
        "§ 16 a",
        "Section 16 a of the sports insurance law. It sets out when insurers must give notice about limiting or stopping this cover and who receives it."
      ],
      [
        "Ministry draft",
        "Proposed wording that the ministry puts out for comments before the government files a bill with Parliament."
      ],
      [
        "StVM 7/2026 vp",
        "The report on this bill from Parliament’s Social Affairs and Health Committee. Sosiaali- ja terveysvaliokunnan mietintö is the Finnish name for this type of report."
      ],
      [
        "EV 83/2026 vp",
        "Parliament’s formal response, known as eduskunnan vastaus. It records the wording Parliament adopted for this bill."
      ],
      [
        "Act 594/2026",
        "The reference number for the signed sports insurance changes published in Finland’s statute book."
      ]
    ]
  },
  "sports-reasons": {
    "step": "What the committee said",
    "tag": "The committee’s reasons",
    "title": "Why add policyholders?",
    "lead": "The ministry’s summary named JPY among several groups seeking changes to notice. The government addressed that feedback in its April bill, and the committee considered the issue in June.",
    "chart": {
      "rows": [
        [
          "Why it kept the deadline",
          "The ministry said a longer warning requirement might put insurers off offering cover."
        ],
        [
          "Why it added policyholders",
          "The committee said a warning would help protect the people or clubs buying the insurance."
        ]
      ]
    },
    "notes": [
      "The committee discussed the hearing requests together. JPY’s role in the final wording remains unclear."
    ],
    "more": [
      "When the government sent the bill to Parliament, it raised a concern about the supply of insurance. It said that giving more warning or having to warn more people could make insurers less willing to offer cover.",
      "The committee took the ministry’s concern about timing into account. It based its decision about recipients on protecting the party with the insurance contract."
    ],
    "sources": [
      "Committee report, StVM 7/2026 vp, “Ilmoitusvelvollisuus”",
      "Introduced bill, § 6, consultation feedback",
      "Ministry summary of consultation responses, p. 3",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "JPY",
        "Jalkapallon Pelaajayhdistys, the association that represents football players in Finland."
      ],
      [
        "Policyholder",
        "The person or organisation that took out the insurance. When a club buys cover for a player, the club holds the policy and the player is insured."
      ],
      [
        "Consultation summary",
        "The ministry’s account of feedback on its draft. It groups or lists the views that people and organisations submitted."
      ],
      [
        "StVM 7/2026 vp",
        "The report on this bill from Parliament’s Social Affairs and Health Committee. Sosiaali- ja terveysvaliokunnan mietintö is the Finnish name for this type of report."
      ]
    ]
  },
  "sports-disclosures": {
    "step": "What JPY disclosed",
    "tag": "Lobbying register",
    "title": "JPY disclosed lobbying",
    "lead": "The players’ association reported lobbying the ministry on the sports insurance project.",
    "chart": {
      "caption": "Reporting period",
      "period": "January–June 2026",
      "months": [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun"
      ]
    },
    "notes": [
      "The entry names the sports insurance project and gives a six-month reporting window. JPY’s formal submissions have their own dates. Individual lobbying contact dates are unknown."
    ],
    "more": [
      "The Transparency Register covers lobbying directed at ministries and Parliament. Its rules exempt participation in documented official hearings.",
      "JPY’s March written response gives the details of the notice it wanted. The register topic identifies the project that JPY reported lobbying on."
    ],
    "sources": [
      "Transparency Register, JAL-26-8286-T, topic 35079",
      "Transparency Register guide to reportable activity",
      "JPY’s ministry submission, 6 March, p. 1",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "JPY",
        "Jalkapallon Pelaajayhdistys, the association that represents football players in Finland."
      ],
      [
        "Transparency Register",
        "Finland’s public record where organisations report lobbying and lobbying advice directed at Parliament or ministries."
      ],
      [
        "Reporting period",
        "The months covered by a register filing. A single period can include contacts on several different dates."
      ],
      [
        "Documented official hearing",
        "A formal chance to give evidence or views as part of lawmaking, with a record of who took part or what they submitted."
      ]
    ]
  },
  "gambling-intro": {
    "step": "What the law does",
    "tag": "Gambling reform",
    "title": "Finland opens its betting market",
    "lead": "From 1 July 2027, people in mainland Finland can gamble with licensed rivals of state-owned Veikkaus.",
    "chart": {
      "caption": "Examples under the new law",
      "rows": [
        [
          "Open to rivals",
          "Betting and online casinos"
        ],
        [
          "Veikkaus only",
          "Lotteries and scratch cards"
        ]
      ]
    },
    "notes": [
      "The government says the change is meant to bring more gambling under Finnish supervision and reduce harm. Companies that enter the market will have to follow rules on protecting players."
    ],
    "more": [
      "Gambling companies could start applying for licences on 1 March 2026, ahead of the market opening. Veikkaus can also compete for licences in the new market.",
      "Games such as in-person casino games and physical slot machines remain under the exclusive licence. Online bingo is among the games that open to competition."
    ],
    "sources": [
      "Interior Ministry’s guide to the change (English)",
      "Gambling Act 10/2026, §§ 5–6 and 106 (PDF)",
      "Parliament’s list of document abbreviations (PDF)",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "HE … vp",
        "Hallituksen esitys (HE) means government bill. Valtiopäivät (vp) is the parliamentary session. Together with the number and year, these identify the bill in Parliament’s records."
      ],
      [
        "Veikkaus",
        "Finland’s state-owned gambling company. The reform opens part of its exclusive mainland market to licensed competitors from 1 July 2027."
      ],
      [
        "Gambling licence",
        "Permission from a regulator to offer specified gambling games under the rules of the Gambling Act."
      ],
      [
        "Exclusive licence",
        "Permission reserved for one operator for certain games. Lotteries and scratch cards are examples under the new Gambling Act."
      ]
    ]
  },
  "gambling-outcome": {
    "step": "How far back regulators look",
    "tag": "Gambling licences",
    "title": "A shorter check on past penalties",
    "lead": "Certain past orders or penalties can still stop a company getting a licence. The lookback is how far back the regulator checks.",
    "chart": {
      "caption": "How far back this licence rule looks",
      "rows": [
        [
          "First draft",
          "5 years"
        ],
        [
          "Signed law",
          "2 years"
        ]
      ],
      "axis": [
        "Earlier",
        "Day of licence check"
      ]
    },
    "notes": [
      "For example, the regulator might have ordered a company to stop advertising gambling after it broke the Lotteries Act. That type of order falls under this check when it meets the time limits."
    ],
    "more": [
      "The check uses the date the order was issued or the penalty imposed. The final text counts those records only when they meet both the two-year window and the fixed cutoff.",
      "The same section gives a separate three-year window for certain orders or penalties for offering or marketing games without the licence required by the new Gambling Act."
    ],
    "sources": [
      "July 2024 draft, § 10, p. 309",
      "Gambling Act 10/2026, § 10(2)(8) (PDF)",
      "Gambling Act 10/2026, § 10 (English translation)"
    ],
    "terms": [
      [
        "Lookback",
        "How far back the regulator checks for relevant orders or penalties when it considers a licence application."
      ],
      [
        "Lotteries Act",
        "Finland’s Arpajaislaki. The orders and penalties counted under the two-year rule were issued for breaches of this act."
      ],
      [
        "Prohibition order (injunction)",
        "A regulator’s formal order to stop an activity, such as marketing gambling in breach of the Lotteries Act."
      ],
      [
        "Penalty payment",
        "A payment the regulator orders for a breach of the law."
      ]
    ]
  },
  "gambling-requests": {
    "step": "What Betsson asked for",
    "tag": "Formal submission",
    "title": "Betsson asked to drop the rule",
    "lead": "The gambling company gave the Interior Ministry two options in its August 2024 response to the draft.",
    "chart": {
      "rows": [
        [
          "First choice",
          "Drop the licence restriction for past orders or penalties"
        ],
        [
          "If the rule stays",
          "Look back at most two years"
        ]
      ]
    },
    "notes": [
      "Betsson argued that applying a new licensing rule to past breaches would give those breaches new consequences. Kindred, another gambling company, also challenged the five-year period. A Finnish gambling industry association argued for a shorter window."
    ],
    "more": [
      "Selin’s study found that several international companies and trade groups made legal arguments about the licensing standard. The European Gaming and Betting Association raised similar concerns during parliamentary hearings.",
      "The final text sets a two-year period for those sanctions, matching Betsson’s fallback on timing. It keeps the orders and penalties as grounds for refusing a licence."
    ],
    "sources": [
      "Betsson’s submission, pp. 6 and 15",
      "Ministry’s consultation summary, § 10",
      "Jani Selin’s study, Results and Discussion",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "Betsson Group",
        "The gambling company that filed the two requests shown here."
      ],
      [
        "Kindred",
        "Another online gambling company that submitted comments on the draft."
      ],
      [
        "EGBA",
        "The European Gaming and Betting Association, a trade group for online gambling operators."
      ],
      [
        "Formal submission",
        "A written response filed with a ministry during consultation or with a parliamentary committee examining the bill."
      ]
    ]
  },
  "gambling-versions": {
    "step": "The cutoff in the law",
    "tag": "The wording",
    "title": "The two-year rule has a cutoff",
    "lead": "Regulators count certain Lotteries Act orders and penalties issued in the two years before the licence check and after 1 September 2024.",
    "chart": {
      "rows": [
        [
          "Jul 2024",
          "Ministry draft",
          "Five years"
        ],
        [
          "Mar 2025",
          "Bill enters Parliament",
          "Two years, with cutoff"
        ],
        [
          "Dec 2025",
          "Committee report",
          "Keeps the rule"
        ],
        [
          "Jan 2026",
          "Signed law",
          "Keeps the rule"
        ]
      ]
    },
    "notes": [
      "Suppose a regulator checked an application on 1 March 2026. An order from July 2024 would be less than two years old. It falls outside this rule because it predates the cutoff. A similar order from 2 September 2024 falls within both limits.",
      "Researcher Jani Selin suggests industry objections may have shaped the shorter limit. Betsson’s role remains unclear."
    ],
    "more": [
      "The rule covers orders and penalties for offering or marketing gambling in breach of the Lotteries Act. The government described it as one of the checks on whether an applicant was fit to run gambling.",
      "Selin studied 36 formal statements from the industry. Nineteen were responses to the ministry’s consultation and 17 were submissions for parliamentary hearings. His analysis draws on those public statements."
    ],
    "sources": [
      "Ministry draft, § 10, p. 309",
      "Introduced bill, § 10 and its explanation",
      "Committee report, HaVM 28/2025 vp, § 10",
      "Gambling Act 10/2026, § 10(2)(8) (PDF)",
      "Jani Selin, Finnish Institute for Health and Welfare, Discussion",
      "Gambling Act 10/2026, § 10 (English translation)"
    ],
    "terms": [
      [
        "Cutoff date",
        "The fixed date an order or penalty must come after to count under this rule. For this rule, that date is 1 September 2024."
      ],
      [
        "Lookback",
        "How far back the regulator checks for relevant orders or penalties when it considers a licence application."
      ],
      [
        "Lotteries Act",
        "Finland’s Arpajaislaki. The orders and penalties counted under the two-year rule were issued for breaches of this act."
      ],
      [
        "HaVM 28/2025 vp",
        "The Administration Committee’s main report on the gambling bill. HaVM is short for hallintovaliokunnan mietintö."
      ],
      [
        "THL",
        "The Finnish Institute for Health and Welfare. It is the institution listed for Jani Selin in the study cited here."
      ]
    ]
  },
  "gambling-pool-betting": {
    "step": "What changed for horse racing",
    "tag": "Horse-race betting",
    "title": "Horse-race pools will open to rivals",
    "lead": "In pool betting, bets go into a common pot and winners share the payout. ATG, a Swedish betting company, asked Finland to let rivals offer these bets.",
    "chart": {
      "caption": "",
      "rows": [
        [
          "July 2024 draft",
          "Veikkaus only"
        ],
        [
          "Signed law",
          "Open to licensed rivals"
        ]
      ]
    },
    "notes": [
      "A cabinet committee announced on 1 November 2024 that horse-race pools would join other kinds of betting in the licensed market. The ministry was still working on the bill when that decision was made.",
      "Others, including Suomen Hippos, backed the change. Paf wanted to keep it exclusive. ATG’s role in the decision remains unclear."
    ],
    "more": [
      "The government’s bill weighed whether it made sense to treat horse-race pools like other betting. It said international cooperation among licensed operators could help make horse-race betting more competitive.",
      "The bill also considered whether opening the market would lead to more marketing. These were arguments the government set out when it brought the proposal to Parliament."
    ],
    "sources": [
      "Ministry draft, §§ 5–6, p. 307",
      "ATG’s consultation submission, pp. 3–5",
      "Ministry’s summary of responses, pp. 18–22",
      "Government decision, 1 November 2024",
      "Introduced bill, § 5.1.3 on horse-race betting (PDF)",
      "Gambling Act 10/2026, §§ 4–6 (PDF)",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "Pool betting (totopelit)",
        "Players’ bets go into a common fund. The winners share the money available for prizes."
      ],
      [
        "ATG",
        "AB Trav och Galopp, a Swedish betting company that offers wagers on horse races."
      ],
      [
        "Suomen Hippos",
        "Finland’s national organisation for trotting and horse breeding."
      ],
      [
        "Paf",
        "Ålands Penningautomatförening, a gambling operator based in Åland."
      ],
      [
        "Cabinet committee",
        "A group of government ministers. Finland’s Economic Policy Ministerial Committee announced the decision to open horse-race pools to licensed competition."
      ]
    ]
  },
  "gambling-register": {
    "step": "What Veikkaus disclosed",
    "tag": "Lobbying register",
    "title": "Veikkaus disclosed lobbying",
    "lead": "The state-owned gambling company reported lobbying the ministry and Parliament about the reform.",
    "chart": {
      "caption": "Reporting period",
      "period": "April–June 2024",
      "months": [
        "Apr",
        "May",
        "Jun"
      ]
    },
    "notes": [
      "The window runs from April to June 2024, before the ministry put out its July draft. The disclosure covers the reform project as a whole. Individual contact dates are unknown."
    ],
    "more": [
      "The project number in the register matches the Interior Ministry’s preparation file. The ministry started that project in October 2023.",
      "Veikkaus filed this as direct lobbying. Register entries give the subject and targets over the reporting window."
    ],
    "sources": [
      "Transparency Register, VEI-24-699-T, topic 2864",
      "Interior Ministry project and July 2024 draft",
      "Transparency Register guide to reportable activity",
      "Illustrations by Health Icons (CC0)"
    ],
    "terms": [
      [
        "Transparency Register",
        "Finland’s public record where organisations report lobbying and lobbying advice directed at Parliament or ministries."
      ],
      [
        "Direct lobbying",
        "Contact with decision-makers to influence an issue. This entry comes from Veikkaus’s report on its own lobbying."
      ],
      [
        "Reporting period",
        "The months covered by a register filing. A single period can include contacts on several different dates."
      ],
      [
        "Project number SM053:00/2023",
        "The Interior Ministry’s reference for the gambling reform project. It lets readers match a register entry to the government’s project documents."
      ]
    ]
  },
  "gambling-disclosures": {
    "step": "What an MP declared",
    "tag": "Gift declaration",
    "title": "An MP declared a ticket from Veikkaus",
    "lead": "Ville Kaunisto served as vice-chair of the Economic Affairs Committee during its review of the bill.",
    "chart": {
      "ticket": [
        "Basketball ticket",
        "€490"
      ],
      "rows": [
        [
          "7 May 2025",
          "Committee record",
          "Kaunisto took part in the final review of the opinion"
        ],
        [
          "27 Aug 2025",
          "Gift declaration",
          "Reported date of use"
        ],
        [
          "16 Sep 2025",
          "Gift declaration",
          "Kaunisto filed the declaration"
        ]
      ]
    },
    "notes": [
      "The ticket was for a Finland–Sweden basketball game. The declaration names Veikkaus, whose monopoly was under review, as the donor. The May date comes from Parliament’s committee record. The two later dates come from Kaunisto’s declaration.",
      "The offer and receipt dates are unknown, as is any effect on the committee’s opinion."
    ],
    "more": [
      "The Economic Affairs Committee gave an advisory opinion. The Administration Committee led Parliament’s review of the bill and issued its main report in December 2025.",
      "The participant list is the source for Kaunisto’s committee role. The use date and value of the ticket come from his own declaration. Veikkaus’s earlier register entry records the company’s lobbying on the reform."
    ],
    "sources": [
      "Economic Affairs Committee opinion, TaVL 12/2025 vp, participants",
      "Parliament’s gift declaration, member 1425, 2025 entry 20",
      "Donor’s gambling reform disclosure, topic 2864",
      "Administration Committee’s main report, HaVM 28/2025 vp"
    ],
    "terms": [
      [
        "MP",
        "Member of Parliament."
      ],
      [
        "Gift declaration",
        "A public filing in which an MP reports receiving a gift or benefit, with details such as who gave it and what it was worth."
      ],
      [
        "TaVL 12/2025 vp",
        "The Economic Affairs Committee’s advisory opinion on the gambling bill. TaVL is short for talousvaliokunnan lausunto."
      ],
      [
        "HaVM 28/2025 vp",
        "The Administration Committee’s main report on the gambling bill. HaVM is short for hallintovaliokunnan mietintö."
      ]
    ]
  }
};
