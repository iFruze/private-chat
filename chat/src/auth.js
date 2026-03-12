import {auth} from "./firebase"
import { signInAnonymously } from "firebase/auth"

export async function login() {
    const res = await signInAnonymously(auth)
    return res.user.uid
}
