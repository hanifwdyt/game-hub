import type { Metadata } from "next";
import { Doc } from "@/components/Doc";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return (
    <Doc kicker="Plain words" title="Privacy">
      <p>This is a small community project. We keep as little as we can.</p>
      <h2>What we store</h2>
      <ul>
        <li><b>Guest play:</b> a random id, so your progress can follow you. No name, no email.</li>
        <li><b>If you create an account:</b> your username, email and a salted password hash.</li>
        <li><b>Your games:</b> play time, sessions, favourites, chapters cleared, achievements and your save files.</li>
        <li><b>Technical:</b> a session cookie that keeps you signed in. Nothing else — no ads, no tracking cookies, no analytics services.</li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell or share your data, and we do not use it to train AI models.</li>
        <li>We do not collect precise location, contacts or anything from your device beyond the above.</li>
      </ul>
      <h2>Children</h2>
      <p>Bambu Runcing is an action game with wartime violence. If you are under 13, please play with a parent or guardian. Accounts are for people 13 and older; guest play needs no personal data at all.</p>
      <h2>Your choices</h2>
      <p>You can play without an account at any time. To delete your account and everything stored about you, ask us and it is removed.</p>
      <p className="doc-note">This page will be extended with a contact address and the formal notices Indonesian law requires before the hub is promoted widely.</p>
    </Doc>
  );
}
