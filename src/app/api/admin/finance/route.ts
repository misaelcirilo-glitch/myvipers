import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const periodSchema = z.enum(['dia', 'semana', 'mes', 'anio']).catch('mes');

export async function GET(req: Request) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'waiter')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = periodSchema.parse(searchParams.get('period') ?? 'mes');

    // El rango del periodo se calcula en SQL contra CURRENT_DATE.
    const transactions = await db`
        SELECT id, type, amount, description, category, date, created_at
        FROM finance_transactions
        WHERE (
            (${period} = 'dia'    AND date = CURRENT_DATE) OR
            (${period} = 'semana' AND date >= date_trunc('week', CURRENT_DATE)) OR
            (${period} = 'mes'    AND date >= date_trunc('month', CURRENT_DATE)) OR
            (${period} = 'anio'   AND date >= date_trunc('year', CURRENT_DATE))
        )
        ORDER BY date DESC, created_at DESC
        LIMIT 500
    `;

    const summaryRows = await db`
        SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
        FROM finance_transactions
        WHERE (
            (${period} = 'dia'    AND date = CURRENT_DATE) OR
            (${period} = 'semana' AND date >= date_trunc('week', CURRENT_DATE)) OR
            (${period} = 'mes'    AND date >= date_trunc('month', CURRENT_DATE)) OR
            (${period} = 'anio'   AND date >= date_trunc('year', CURRENT_DATE))
        )
    `;

    const income = Number(summaryRows[0].income);
    const expense = Number(summaryRows[0].expense);
    const summary = { income, expense, balance: income - expense };

    // Compatibilidad: month/today siguen disponibles para consumidores previos.
    const monthRows = await db`
        SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
        FROM finance_transactions
        WHERE date >= date_trunc('month', CURRENT_DATE)
    `;

    const todayRows = await db`
        SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as today_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as today_expense
        FROM finance_transactions
        WHERE date = CURRENT_DATE
    `;

    return NextResponse.json({
        period,
        transactions,
        summary,
        month: monthRows[0],
        today: todayRows[0],
    });
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { type, amount, description, category, date } = body;

    if (!type || !amount || !description) {
        return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const tx = await db`
        INSERT INTO finance_transactions (type, amount, description, category, date)
        VALUES (${type}, ${amount}, ${description}, ${category || 'general'}, ${date || new Date().toISOString().split('T')[0]})
        RETURNING id, type, amount, description, category, date
    `;

    return NextResponse.json({ transaction: tx[0] });
}

export async function DELETE(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await req.json();
    await db`DELETE FROM finance_transactions WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
}
